import { todayKst, toUtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import type { TrialTrackingDeps } from '../deps';
import { planCancelConfirmSlots, planInitialSlots } from '../domain/notification-planner';
import { computeTrialDates } from '../domain/trial-dates';
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
 * 기록 수정 (SPEC §5 수정 범위, §6 재예약, 스토리 42). `TRACKING`·`CANCEL_ATTEMPTED`만 허용하고 상태는 바꾸지 않는다.
 * 날짜 UPDATE, 아직 보내지 않은 알림 취소, 새 날짜 기준 재예약을 한 batch로 저장한다.
 * `safeEndDate`가 그대로이면(예: 시작일과 일수를 함께 바꿔 합이 같음) 알림 마감일이 같으므로 예약은 건드리지 않는다.
 */
export async function updateTrialRecord(
  deps: TrialTrackingDeps,
  cmd: UpdateTrialRecordCommand,
): Promise<TrialRecordView> {
  const record = await loadOwned(deps, cmd);
  if (record.status !== 'TRACKING' && record.status !== 'CANCEL_ATTEMPTED') {
    throw new DomainError(
      'INVALID_TRANSITION',
      `${record.status} 상태의 기록은 수정할 수 없습니다`,
    );
  }

  const today = todayKst(deps.clock);
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

  const statements = [prepareDatesUpdate(deps.db, record, next)];
  if (next.safeEndDate !== record.safeEndDate) {
    const now = toUtcInstant(deps.clock.now());
    const settings = { sendTime: await readSendTime(deps.db) };
    const guard = { status: record.status, safeEndDate: next.safeEndDate };
    const newSlots =
      record.status === 'TRACKING'
        ? planInitialSlots(next, now, settings)
        : planCancelConfirmSlots(next, now, settings);
    statements.push(
      preparePendingSlotCancel(deps.db, record.id, guard),
      ...prepareSlotInserts(deps.db, record.id, newSlots, guard),
    );
  }

  const [update] = await runBatch(deps.db, statements);
  if (update?.meta.changes !== 1) throw conflict();
  return toTrialRecordView(next, terms.name, today);
}
