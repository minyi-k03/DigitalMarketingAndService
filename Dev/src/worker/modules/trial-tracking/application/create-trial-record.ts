import { todayKst, toUtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import { newId } from '../../../platform/id';
import type { TrialTrackingDeps } from '../deps';
import { computeTrialDates } from '../domain/trial-dates';
import {
  assertNotEnded,
  assertRegistrable,
  validateTrialInput,
} from '../domain/validate-trial-input';
import {
  findActiveRecordId,
  insertTrialRecord,
  type TrialRecord,
  type TrialSource,
} from '../infra/trial-repo';
import { toTrialRecordView, type TrialRecordView } from './to-trial-record-view';

export interface CreateTrialRecordCommand {
  userId: string;
  catalogItemId: string;
  /** 생략하면 오늘(KST) */
  startDate?: string;
  /** 생략하면 카탈로그의 기본 체험 일수 */
  trialDays?: number;
  /** P0에서는 MANUAL_CATALOG_SELECT만 허용한다 */
  source?: TrialSource;
}

/** 1초 간편 등록 (SPEC §3 경로 A, §4) */
export async function createTrialRecord(
  deps: TrialTrackingDeps,
  cmd: CreateTrialRecordCommand,
): Promise<TrialRecordView> {
  const terms = await deps.catalog.getTrackingTerms(cmd.catalogItemId);
  assertRegistrable(terms.publicationStatus);
  const today = todayKst(deps.clock);
  const { startDate, trialDays } = validateTrialInput({
    startDate: cmd.startDate ?? today,
    trialDays: cmd.trialDays ?? terms.defaultTrialDays,
    source: cmd.source ?? 'MANUAL_CATALOG_SELECT',
    today,
  });
  const bufferApplied = terms.isGlobalTimeZoneBufferRequired;
  const dates = computeTrialDates(startDate, trialDays, bufferApplied);
  assertNotEnded(dates.billingDate, today);
  const now = toUtcInstant(deps.clock.now());

  const record: TrialRecord = {
    id: newId(),
    userId: cmd.userId,
    catalogItemId: cmd.catalogItemId,
    source: cmd.source ?? 'MANUAL_CATALOG_SELECT',
    startDate,
    trialDays,
    bufferApplied,
    ...dates,
    status: 'TRACKING',
    savedAmount: null,
    statusChangedAt: now,
    createdAt: now,
  };
  if (!(await insertTrialRecord(deps.db, record))) {
    const existingTrialRecordId = await findActiveRecordId(deps.db, cmd.userId, cmd.catalogItemId);
    if (existingTrialRecordId === undefined) {
      // 충돌한 기록이 그 사이 끝난 경우. 호출자가 다시 시도하면 된다
      throw new DomainError('CONFLICT', '잠시 뒤 다시 시도해 주세요');
    }
    throw new DomainError('DUPLICATE_ACTIVE_RECORD', '이미 진행 중인 체험 기록이 있습니다', {
      existingTrialRecordId,
    });
  }

  return toTrialRecordView(record, terms.name, today);
}
