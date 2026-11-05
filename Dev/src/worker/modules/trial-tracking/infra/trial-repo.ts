import type { components } from '../../../../shared/api-types';
import type { KstDate, UtcInstant } from '../../../../shared/kst-date';

export type TrialSource = components['schemas']['TrialSource'];
export type TrialStatus = components['schemas']['TrialStatus'];

/** `trial_records` 한 행을 앱 쪽 이름으로 옮긴 것 (SPEC §19 TrialRecord) */
export interface TrialRecord {
  id: string;
  userId: string;
  catalogItemId: string;
  source: TrialSource;
  startDate: KstDate;
  trialDays: number;
  bufferApplied: boolean;
  billingDate: KstDate;
  safeEndDate: KstDate;
  status: TrialStatus;
  savedAmount: number | null;
  statusChangedAt: UtcInstant;
  createdAt: UtcInstant;
}

/**
 * 기록을 저장한다. 같은 사용자·항목의 진행 중 기록이 이미 있으면(부분 UNIQUE 인덱스 위반) `false`다.
 * 확인 후 저장하는 사이에 끼어드는 동시 요청도 이 제약이 막으므로 중복 판정은 DB가 한다.
 */
export async function insertTrialRecord(db: D1Database, record: TrialRecord): Promise<boolean> {
  try {
    await runInsert(db, record);
    return true;
  } catch (e) {
    if (e instanceof Error && e.message.includes('UNIQUE constraint failed')) return false;
    throw e;
  }
}

/** 진행 중(TRACKING·CANCEL_ATTEMPTED)인 기록 id */
export async function findActiveRecordId(
  db: D1Database,
  userId: string,
  catalogItemId: string,
): Promise<string | undefined> {
  const row = await db
    .prepare(
      `SELECT id FROM trial_records
       WHERE user_id = ? AND catalog_item_id = ? AND status IN ('TRACKING', 'CANCEL_ATTEMPTED')`,
    )
    .bind(userId, catalogItemId)
    .first<{ id: string }>();
  return row?.id;
}

async function runInsert(db: D1Database, record: TrialRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO trial_records (
         id, user_id, catalog_item_id, source, start_date, trial_days, buffer_applied,
         billing_date, safe_end_date, status, saved_amount, status_changed_at, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.userId,
      record.catalogItemId,
      record.source,
      record.startDate,
      record.trialDays,
      record.bufferApplied ? 1 : 0,
      record.billingDate,
      record.safeEndDate,
      record.status,
      record.savedAmount,
      record.statusChangedAt,
      record.createdAt,
    )
    .run();
}
