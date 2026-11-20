import type { components } from '../../../../shared/api-types';
import type { KstDate } from '../../../../shared/kst-date';
import { actionsFor, dDayLabel } from '../domain/trial-view';
import type { TrialRecord } from '../infra/trial-repo';

export type TrialRecordView = components['schemas']['TrialRecordView'];

/** 화면에 같이 보일 카탈로그 쪽 값 (`getTrackingTerms`의 일부) */
export interface CatalogDisplay {
  name: string;
  logoUrl?: string | undefined;
}

/**
 * 기록을 화면용 응답으로 옮긴다 (SPEC §13, §19). 필드를 하나씩 적어 `userId`가 나가지 않게 한다.
 */
export function toTrialRecordView(
  record: TrialRecord,
  catalog: CatalogDisplay,
  today: KstDate,
): TrialRecordView {
  return {
    id: record.id,
    catalogItemId: record.catalogItemId,
    catalogItemName: catalog.name,
    ...(catalog.logoUrl !== undefined && { catalogItemLogoUrl: catalog.logoUrl }),
    source: record.source,
    startDate: record.startDate,
    trialDays: record.trialDays,
    bufferApplied: record.bufferApplied,
    billingDate: record.billingDate,
    safeEndDate: record.safeEndDate,
    status: record.status,
    ...(record.exitReason !== undefined && { exitReason: record.exitReason }),
    ...(record.cancelAttemptedAt !== undefined && {
      cancelAttemptedAt: record.cancelAttemptedAt,
    }),
    ...(record.confirmedAt !== undefined && { confirmedAt: record.confirmedAt }),
    savedAmount: record.savedAmount,
    statusChangedAt: record.statusChangedAt,
    dDayLabel: dDayLabel(record.status, today, record.safeEndDate, record.billingDate),
    actions: actionsFor(record.status),
  };
}
