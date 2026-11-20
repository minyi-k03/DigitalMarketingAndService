import { kstAt, kstDateOf, toUtcInstant } from '../../../../shared/kst-date';
import type { TrialTrackingDeps } from '../deps';
import { applyTransition, statesAllowing } from '../domain/transitions';
import {
  prepareBillingCheckInserts,
  prepareLeftoverSlotCancelForMissedBilled,
  readSendTime,
} from '../infra/notification-repo';
import { prepareBillingDatePassedUpdate } from '../infra/trial-repo';

export interface MissedBilledBatchResult {
  /** 이번 실행이 `MISSED_BILLED`로 바꾼 기록 수 */
  transitioned: number;
  /** 이번 실행이 새로 저장한 결제 확인 알림(`BILLING_CHECK`) 수. 전이된 기록 + 이전 실행이 놓친 기록 */
  scheduled: number;
}

/**
 * 매일 00:10 KST(15:10 UTC) 배치 (SPEC §5·§6·§17, architecture §5.7, 스토리 31). `BillingDate`가 오늘(KST)보다
 * 이전인 `TRACKING`·`CANCEL_ATTEMPTED` 기록을 `MISSED_BILLED`로 전이하고, 남은 알림을 취소하고, 기본 발송 시각에
 * `BILLING_CHECK`를 예약한다. 세 단계가 D1 batch 하나라 중간에 멈춰도 일부만 반영되지 않는다.
 *
 * 몇 번을 실행해도 결과가 같다: 전이는 `WHERE status = :from` 조건부라 이미 바뀐 기록은 0행이고, 알림은 유일 키와
 * `NOT EXISTS`로 한 번만 들어가며, 알림 취소는 같은 대상을 다시 취소할 뿐이다. 겹쳐 실행돼도 D1이 batch를 직렬로
 * 처리하므로 같은 기록을 두 번 전이하지 않는다. 이 같은 성질로 `BILLING_CHECK`가 빠진 `MISSED_BILLED` 기록
 * (과거에 전이만 되고 멈춘 경우)도 다음 실행이 채운다.
 *
 * 상태 전이는 `applyTransition`(`BILLING_DATE_PASSED`)이 정한 결과만 저장한다. 시계는 한 번만 읽어
 * '오늘(KST)'과 전이·발송 시각이 같은 시점을 본다.
 */
export async function runMissedBilledBatch(
  deps: TrialTrackingDeps,
): Promise<MissedBilledBatchResult> {
  const now = toUtcInstant(deps.clock.now());
  const today = kstDateOf(now);
  // 설정이 올바르지 않으면 batch 전에 던져 전이·알림이 모두 그대로다 (읽기 순서가 곧 실패 격리)
  const sendAt = kstAt(today, await readSendTime(deps.db));

  const updates = statesAllowing('BILLING_DATE_PASSED').map((from) => {
    const transition = applyTransition(
      { status: from, statusChangedAt: now },
      'BILLING_DATE_PASSED',
      now,
    );
    return prepareBillingDatePassedUpdate(
      deps.db,
      from,
      transition.to,
      transition.statusChangedAt,
      today,
    );
  });
  const results = await deps.db.batch([
    ...updates,
    prepareLeftoverSlotCancelForMissedBilled(deps.db),
    prepareBillingCheckInserts(deps.db, sendAt),
  ]);

  const transitioned = results
    .slice(0, updates.length)
    .reduce((sum, result) => sum + result.meta.changes, 0);
  const scheduled = results[results.length - 1]?.meta.changes ?? 0;
  return { transitioned, scheduled };
}
