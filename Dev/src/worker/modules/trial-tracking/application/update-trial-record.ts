import { kstDateOf, toUtcInstant } from '../../../../shared/kst-date';
import type { TrialTrackingDeps } from '../deps';
import { planCancelConfirmSlots, planInitialSlots } from '../domain/notification-planner';
import { computeTrialDates } from '../domain/trial-dates';
import { applyTransition } from '../domain/transitions';
import { assertNotEnded, validateTrialDates } from '../domain/validate-trial-input';
import {
  preparePendingSlotCancel,
  prepareSlotInserts,
  readSendTime,
} from '../infra/notification-repo';
import { prepareDatesUpdate, type TrialRecord } from '../infra/trial-repo';
import { toTrialRecordView, type TrialRecordView } from './to-trial-record-view';
import { conflict, loadOwned, runBatch, type TrialRecordRef } from './trial-command-support';

export interface UpdateTrialRecordCommand extends TrialRecordRef {
  /** 생략하면 기존 시작일 */
  startDate?: string;
  /** 생략하면 기존 체험 일수 */
  trialDays?: number;
}

/**
 * 기록 수정 (SPEC §5 수정 범위, §6 재예약, 스토리 42). `TRACKING`·`CANCEL_ATTEMPTED`만 허용하고(전이표의
 * `UPDATE_DATES`) 상태는 바꾸지 않는다. 아직 보내지 않은 알림 취소, 새 날짜 기준 재예약, 날짜 UPDATE를
 * 한 batch로 저장한다.
 *
 * 문장 순서: 알림 문장이 먼저, 날짜 UPDATE가 마지막이다. 알림 문장의 가드와 날짜 UPDATE의 `WHERE`가 모두
 * "기록이 읽은 상태·시작일·체험 일수 그대로"를 조건으로 삼으므로, 다른 요청이 먼저 기록을 바꿨다면 둘 다
 * 적용되지 않고 `CONFLICT`다. 먼저 저장된 요청의 알림은 밀린 요청이 취소하거나 덮지 않는다.
 *
 * `safeEndDate`가 그대로이면(예: 시작일과 일수를 함께 바꿔 합이 같음) 알림 마감일이 같으므로 예약은 건드리지 않는다.
 */
export async function updateTrialRecord(
  deps: TrialTrackingDeps,
  cmd: UpdateTrialRecordCommand,
): Promise<TrialRecordView> {
  const record = await loadOwned(deps, cmd);
  // 시계는 한 번만 읽고 오늘(KST)도 거기서 얻는다. 검증과 알림 계획이 같은 시점을 본다
  const now = toUtcInstant(deps.clock.now());
  applyTransition(record, 'UPDATE_DATES', now);
  const today = kstDateOf(now);

  const { startDate, trialDays } = validateTrialDates({
    startDate: cmd.startDate ?? record.startDate,
    trialDays: cmd.trialDays ?? record.trialDays,
    today,
  });
  // 버퍼는 기록에 복사해 둔 값을 쓴다. 이후 카탈로그가 바뀌어도 기존 기록은 그대로다 (SPEC §2)
  const dates = computeTrialDates(startDate, trialDays, record.bufferApplied);
  assertNotEnded(dates.billingDate, today);
  const terms = await deps.catalog.getTrackingTerms(record.catalogItemId);

  const next: TrialRecord = { ...record, startDate, trialDays, ...dates };
  if (startDate === record.startDate && trialDays === record.trialDays) {
    return toTrialRecordView(record, terms.name, today);
  }

  const statements: D1PreparedStatement[] = [];
  if (next.safeEndDate !== record.safeEndDate) {
    const settings = { sendTime: await readSendTime(deps.db) };
    const guard = {
      status: record.status,
      startDate: record.startDate,
      trialDays: record.trialDays,
    };
    const newSlots =
      record.status === 'TRACKING'
        ? planInitialSlots(next, now, settings)
        : planCancelConfirmSlots(next, now, settings);
    statements.push(
      preparePendingSlotCancel(deps.db, record.id, guard),
      ...prepareSlotInserts(deps.db, record.id, newSlots, guard),
    );
  }
  statements.push(prepareDatesUpdate(deps.db, record, next));

  const results = await runBatch(deps.db, statements);
  if (results[results.length - 1]?.meta.changes !== 1) throw conflict();
  return toTrialRecordView(next, terms.name, today);
}
