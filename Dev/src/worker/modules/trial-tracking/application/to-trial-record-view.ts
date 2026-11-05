import type { components } from '../../../../shared/api-types';
import type { KstDate } from '../../../../shared/kst-date';
import { actionsFor, dDayLabel } from '../domain/trial-view';
import type { TrialRecord } from '../infra/trial-repo';

export type TrialRecordView = components['schemas']['TrialRecordView'];

/**
 * 기록을 화면용 응답으로 옮긴다 (SPEC §13, §19). 필드를 하나씩 적어 `userId`가 나가지 않게 한다.
 * `exitReason`·`cancelAttemptedAt`·`confirmedAt`은 TRACKING 기록에 없으므로 T14에서 더한다.
 */
export function toTrialRecordView(
  record: TrialRecord,
  catalogItemName: string,
  today: KstDate,
): TrialRecordView {
  return {
    id: record.id,
    catalogItemId: record.catalogItemId,
    catalogItemName,
    source: record.source,
    startDate: record.startDate,
    trialDays: record.trialDays,
    bufferApplied: record.bufferApplied,
    billingDate: record.billingDate,
    safeEndDate: record.safeEndDate,
    status: record.status,
    savedAmount: record.savedAmount,
    statusChangedAt: record.statusChangedAt,
    dDayLabel: dDayLabel(today, record.safeEndDate, record.billingDate),
    actions: actionsFor(record.status),
  };
}
