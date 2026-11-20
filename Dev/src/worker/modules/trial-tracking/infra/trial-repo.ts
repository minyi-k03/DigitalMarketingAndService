import type { components } from '../../../../shared/api-types';
import type { KstDate, UtcInstant } from '../../../../shared/kst-date';

export type TrialSource = components['schemas']['TrialSource'];
export type TrialStatus = components['schemas']['TrialStatus'];
export type ExitReason = components['schemas']['ExitReason'];

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
  /** `exit_poll_responses.reason`의 사본. TRACKING이면 없다 (SPEC §5 불변식) */
  exitReason?: ExitReason;
  cancelAttemptedAt?: UtcInstant;
  confirmedAt?: UtcInstant;
  savedAmount: number | null;
  statusChangedAt: UtcInstant;
  createdAt: UtcInstant;
}

interface TrialRecordRow {
  id: string;
  user_id: string;
  catalog_item_id: string;
  source: TrialSource;
  start_date: string;
  trial_days: number;
  buffer_applied: number;
  billing_date: string;
  safe_end_date: string;
  status: TrialStatus;
  exit_reason: ExitReason | null;
  cancel_attempted_at: string | null;
  confirmed_at: string | null;
  saved_amount: number | null;
  status_changed_at: string;
  created_at: string;
}

function fromRow(row: TrialRecordRow): TrialRecord {
  return {
    id: row.id,
    userId: row.user_id,
    catalogItemId: row.catalog_item_id,
    source: row.source,
    startDate: row.start_date as KstDate,
    trialDays: row.trial_days,
    bufferApplied: row.buffer_applied === 1,
    billingDate: row.billing_date as KstDate,
    safeEndDate: row.safe_end_date as KstDate,
    status: row.status,
    ...(row.exit_reason !== null && { exitReason: row.exit_reason }),
    ...(row.cancel_attempted_at !== null && {
      cancelAttemptedAt: row.cancel_attempted_at as UtcInstant,
    }),
    ...(row.confirmed_at !== null && { confirmedAt: row.confirmed_at as UtcInstant }),
    savedAmount: row.saved_amount,
    statusChangedAt: row.status_changed_at as UtcInstant,
    createdAt: row.created_at as UtcInstant,
  };
}

/** 본인 기록만 돌려준다. 남의 기록은 없는 기록과 똑같이 `undefined`다 (AGENTS §6) */
export async function findOwnedRecord(
  db: D1Database,
  userId: string,
  trialRecordId: string,
): Promise<TrialRecord | undefined> {
  const row = await db
    .prepare('SELECT * FROM trial_records WHERE id = ? AND user_id = ?')
    .bind(trialRecordId, userId)
    .first<TrialRecordRow>();
  return row === null ? undefined : fromRow(row);
}

/**
 * 전이 결과를 저장하는 조건부 UPDATE (architecture §5.2). 읽은 뒤 다른 요청이 먼저 상태를 바꿨으면
 * `WHERE status = :from`이 맞지 않아 0행이 바뀐다. 호출한 쪽이 `meta.changes`로 충돌을 판정한다.
 */
export function prepareStatusUpdate(
  db: D1Database,
  from: TrialStatus,
  next: TrialRecord,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE trial_records
          SET status = ?, status_changed_at = ?, exit_reason = ?,
              cancel_attempted_at = ?, confirmed_at = ?, saved_amount = ?
        WHERE id = ? AND status = ?`,
    )
    .bind(
      next.status,
      next.statusChangedAt,
      next.exitReason ?? null,
      next.cancelAttemptedAt ?? null,
      next.confirmedAt ?? null,
      next.savedAmount,
      next.id,
      from,
    );
}

/**
 * 날짜 수정 결과를 저장하는 조건부 UPDATE (SPEC §5 기록 수정). 읽은 뒤 다른 요청이 상태나 날짜를 먼저
 * 바꿨으면 `WHERE`가 맞지 않아 0행이 바뀌고, 호출한 쪽이 `meta.changes`로 충돌을 판정한다.
 */
export function prepareDatesUpdate(
  db: D1Database,
  prev: TrialRecord,
  next: TrialRecord,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE trial_records
          SET start_date = ?, trial_days = ?, billing_date = ?, safe_end_date = ?
        WHERE id = ? AND status = ? AND start_date = ? AND trial_days = ?`,
    )
    .bind(
      next.startDate,
      next.trialDays,
      next.billingDate,
      next.safeEndDate,
      prev.id,
      prev.status,
      prev.startDate,
      prev.trialDays,
    );
}

/**
 * 기록을 저장한다. 같은 사용자·항목의 진행 중 기록이 이미 있으면(부분 UNIQUE 인덱스 위반) `false`다.
 * 확인 후 저장하는 사이에 끼어드는 동시 요청도 이 제약이 막으므로 중복 판정은 DB가 한다.
 * `followUps`(알림 저장 등)는 같은 batch로 실행하며, 기록 INSERT가 실패하면 함께 롤백된다.
 */
export async function insertTrialRecord(
  db: D1Database,
  record: TrialRecord,
  followUps: readonly D1PreparedStatement[] = [],
): Promise<boolean> {
  try {
    await db.batch([prepareInsert(db, record), ...followUps]);
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

function prepareInsert(db: D1Database, record: TrialRecord): D1PreparedStatement {
  return db
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
    );
}
