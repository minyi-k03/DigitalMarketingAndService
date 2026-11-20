import { kstDateOf, toUtcInstant } from '../../../../shared/kst-date';
import type { NotificationSender } from '../../../ports/notification-sender';
import type { TrialTrackingDeps } from '../deps';
import { buildOutgoingNotification } from '../domain/notification-message';
import {
  claimDueNotifications,
  expireMeaninglessPending,
  findDispatchTarget,
  markSendFailed,
  markSent,
  markSkipped,
  reclaimStaleSending,
  type ClaimedNotification,
} from '../infra/notification-repo';

/** 한 번의 디스패치가 가져가는 최대 슬롯 수. 나머지는 다음 Cron 회차로 넘어간다 (implementation-plan 위험 표) */
const CLAIM_LIMIT = 50;

export interface DispatchCommand {
  /** 주면 그 기록의 슬롯만 처리한다(늦은 등록 즉시 발송). 생략하면 도래한 전체(Cron) */
  trialRecordId?: string;
}

type Outcome = 'sent' | 'skipped' | 'retried' | 'failed';

export interface DispatchResult extends Record<Outcome, number> {
  /** 15분 넘게 `SENDING`에 남아 `PENDING`으로 되돌린 슬롯 */
  reclaimed: number;
  /** 기록 상태·`BillingDate`가 달라져 보낼 의미를 잃어 `EXPIRED`로 닫은 슬롯 */
  expired: number;
  sent: number;
  skipped: number;
  /** 실패했지만 시도 한도 전이라 다음 실행이 다시 보낼 슬롯 */
  retried: number;
  /** 시도 한도에 닿아 `FAILED`로 닫은 슬롯 */
  failed: number;
}

/**
 * 도래한 알림을 발송한다 (SPEC §6·§17, architecture §5.6). 선점한 슬롯만 보내므로 Cron이 겹쳐도
 * 한 슬롯은 한 번만 나간다.
 */
export async function dispatchDueNotifications(
  deps: TrialTrackingDeps,
  cmd: DispatchCommand = {},
): Promise<DispatchResult> {
  // 보낼 어댑터가 없으면 슬롯을 선점하지도 닫지도 않는다. 선점하면 보낼 수 없는 알림이 재시도로 소진돼 FAILED가 된다
  if (deps.sender === undefined) {
    return { reclaimed: 0, expired: 0, sent: 0, skipped: 0, retried: 0, failed: 0 };
  }
  const sender = deps.sender;

  // 시계는 한 번만 읽는다. 선점·'오늘(KST)' 판정이 같은 시점을 본다
  const now = toUtcInstant(deps.clock.now());
  const today = kstDateOf(now);

  const reclaimed = await reclaimStaleSending(deps.db, now, cmd.trialRecordId);
  const expired = await expireMeaninglessPending(deps.db, today, cmd.trialRecordId);
  const claimed = await claimDueNotifications(deps.db, now, today, CLAIM_LIMIT, cmd.trialRecordId);
  const result: DispatchResult = { reclaimed, expired, sent: 0, skipped: 0, retried: 0, failed: 0 };
  for (const slot of claimed) {
    const outcome = await dispatchOne(deps, sender, slot);
    if (outcome !== undefined) result[outcome] += 1;
  }
  return result;
}

/**
 * 슬롯 하나를 보낸다. 한 슬롯의 실패가 같은 회차의 다른 슬롯을 막지 않도록 여기서 삼켜 실패로 기록한다.
 * 결과가 `undefined`이면 실패를 기록하려 했으나 이미 소유를 잃은 행이라 세지 않는다.
 */
async function dispatchOne(
  deps: TrialTrackingDeps,
  sender: NotificationSender,
  slot: ClaimedNotification,
): Promise<Outcome | undefined> {
  let delivered: 'sent' | 'skipped';
  try {
    delivered = await deliver(deps, sender, slot);
  } catch {
    // 오류 메시지에는 수신처 정보가 섞일 수 있어 남기지 않는다 (AGENTS §6)
    return markSendFailed(deps.db, slot);
  }
  if (delivered === 'sent') {
    // 이미 보낸 뒤라 기록이 실패해도 재시도로 되돌리지 않는다(바로 다시 나간다). 행은 `SENDING`으로 남고
    // 15분 뒤 복구된다. 명세가 중복 발송을 허용하는 유일한 경우다 (SPEC §17).
    await markSent(deps.db, slot).catch(() => undefined);
  }
  return delivered;
}

/** 수신처를 확정해 보낸다. 보낸 뒤의 기록(`SENT`)은 호출한 쪽이 맡는다 */
async function deliver(
  deps: TrialTrackingDeps,
  sender: NotificationSender,
  slot: ClaimedNotification,
): Promise<'sent' | 'skipped'> {
  const target = await findDispatchTarget(deps.db, slot.trialRecordId);
  const { recipient } = await deps.identity.getNotificationRecipient(target.userId);
  // 수신을 껐거나 수신처가 없으면 보내지 않는다. 상태 전이는 영향받지 않는다 (SPEC §6)
  if (recipient === undefined) {
    await markSkipped(deps.db, slot);
    return 'skipped';
  }
  const terms = await deps.catalog.getTrackingTerms(target.catalogItemId);
  await sender.send({
    recipient,
    notification: buildOutgoingNotification(slot, {
      catalogItemName: terms.name,
      retentionPolicy: terms.accessRetentionPolicy,
    }),
  });
  return 'sent';
}
