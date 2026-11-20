import type { KstDate, UtcInstant } from '../../../../shared/kst-date';
import { newId } from '../../../platform/id';
import type { NotificationKind, PlannedSlot } from '../domain/notification-planner';
import type { TrialStatus } from './trial-repo';

export type { NotificationKind };

/**
 * 알림을 바꿀 때 같은 batch에서 기록이 명령이 읽은 상태 그대로인지 확인하는 조건. 상태 전이는 앞선 UPDATE가
 * 기록을 새 상태로 만들었는지(`status`)로, 날짜 수정은 기록이 읽은 상태·시작일·체험 일수 그대로인지
 * (`status`, `startDate`, `trialDays`)로 확인한다. 동시 요청에 밀려 조건이 맞지 않으면 알림은 그대로다.
 * 날짜 수정은 알림 문장을 날짜 UPDATE보다 먼저 실행하므로 읽은 날짜 기준으로 확인해야 하며, 이 조건은
 * 같은 batch의 날짜 UPDATE가 성공할 조건과 같아서 둘이 함께 성공하거나 함께 건너뛴다.
 */
export type RecordGuard =
  TrialStatus | { status: TrialStatus; startDate: KstDate; trialDays: number };

function guardClause(trialRecordId: string, guard: RecordGuard) {
  if (typeof guard === 'string') {
    return {
      sql: 'EXISTS (SELECT 1 FROM trial_records WHERE id = ? AND status = ?)',
      params: [trialRecordId, guard],
    };
  }
  return {
    sql: `EXISTS (SELECT 1 FROM trial_records
                   WHERE id = ? AND status = ? AND start_date = ? AND trial_days = ?)`,
    params: [trialRecordId, guard.status, guard.startDate, guard.trialDays],
  };
}

const SEND_TIME_KEY = 'notification.sendTime';
const SEND_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * 기본 발송 시각 `HH:mm`(KST)을 `app_settings`에서 읽는다 (SPEC §6, G5). 값이 없거나 형식이 틀리면
 * 설정 오류이므로 기본값으로 덮지 않고 던진다. 시각을 조용히 바꿔 알림을 보내는 것보다 낫다.
 */
export async function readSendTime(db: D1Database): Promise<string> {
  const row = await db
    .prepare('SELECT value FROM app_settings WHERE key = ?')
    .bind(SEND_TIME_KEY)
    .first<{ value: string }>();
  let parsed: unknown;
  try {
    parsed = row === null ? undefined : JSON.parse(row.value);
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'string' || !SEND_TIME_PATTERN.test(parsed)) {
    throw new Error(`${SEND_TIME_KEY} 설정이 올바르지 않습니다`);
  }
  return parsed;
}

/**
 * 계획된 슬롯을 `PENDING`으로 저장한다 (architecture §5.4). 같은 batch에서 앞선 문장이 기록을
 * `guard` 상태로 만들었을 때만 들어가므로, 동시 요청에 밀린 명령은 알림을 남기지 않는다.
 *
 * 유일 키(기록, 슬롯, `safeEndDate`)가 겹치는 행은 `CANCELED`일 때만 되살린다. 날짜를 A→B→A로 되돌리면
 * A 키의 취소된 행이 남아 있어서, 그냥 무시하면 새 슬롯이 사라진다. 이미 보냈거나(`SENT`) 실패·만료·건너뛴 행은
 * 같은 마감일에 다시 보내지 않도록 그대로 둔다 (SPEC §6).
 */
export function prepareSlotInserts(
  db: D1Database,
  trialRecordId: string,
  slots: readonly PlannedSlot[],
  guard: RecordGuard,
): D1PreparedStatement[] {
  const { sql: guardSql, params: guardParams } = guardClause(trialRecordId, guard);
  return slots.map((slot) =>
    db
      .prepare(
        `INSERT INTO notification_schedules
           (id, trial_record_id, kind, slot, variant, safe_end_date, send_at, status)
         SELECT ?, ?, ?, ?, ?, ?, ?, 'PENDING'
          WHERE ${guardSql}
         ON CONFLICT (trial_record_id, slot, safe_end_date) DO UPDATE
           SET variant = excluded.variant, send_at = excluded.send_at,
               status = 'PENDING', attempts = 0, last_attempt_at = NULL
         WHERE notification_schedules.status = 'CANCELED'`,
      )
      .bind(
        newId(),
        trialRecordId,
        slot.kind,
        slot.slot,
        slot.variant,
        slot.safeEndDate,
        slot.sendAt,
        ...guardParams,
      ),
  );
}

/**
 * 기록의 `PENDING` 알림을 `CANCELED`로 바꾼다 (SPEC §6 알림 취소). `kinds`를 주면 그 종류만 취소한다.
 * 같은 batch에서 앞선 조건부 UPDATE가 기록을 `guard` 상태로 바꿨을 때만 반영되므로,
 * 동시 요청에 밀려 앞선 UPDATE가 0행이면 알림도 그대로 남는다.
 */
export function preparePendingSlotCancel(
  db: D1Database,
  trialRecordId: string,
  guard: RecordGuard,
  kinds?: readonly NotificationKind[],
): D1PreparedStatement {
  const kindFilter = kinds === undefined ? '' : ` AND kind IN (${kinds.map(() => '?').join(', ')})`;
  const { sql: guardSql, params: guardParams } = guardClause(trialRecordId, guard);
  return db
    .prepare(
      `UPDATE notification_schedules SET status = 'CANCELED'
        WHERE trial_record_id = ? AND status = 'PENDING'${kindFilter}
          AND ${guardSql}`,
    )
    .bind(trialRecordId, ...(kinds ?? []), ...guardParams);
}

/**
 * 기록이 아직 이 알림을 보낼 의미가 있는지 (architecture §5.6). 탈출 알림은 기록이 `TRACKING`이고
 * `billingDate`가 지나지 않았을 때, 해지 확인 알림은 `CANCEL_ATTEMPTED`일 때, 결제 확인 알림은
 * `MISSED_BILLED`일 때만 의미가 있다. 발송 선점(claim)과 만료(expire)가 같은 조건을 쓴다.
 */
function meaningfulClause(n: string, r: string) {
  return `((${n}.kind = 'ESCAPE_ALERT' AND ${r}.status = 'TRACKING' AND ${r}.billing_date >= ?)
        OR (${n}.kind = 'CANCEL_CONFIRM_CHECK' AND ${r}.status = 'CANCEL_ATTEMPTED')
        OR (${n}.kind = 'BILLING_CHECK' AND ${r}.status = 'MISSED_BILLED'))`;
}

export interface ClaimedNotification {
  id: string;
  trialRecordId: string;
  kind: NotificationKind;
  slot: string;
  variant: string;
  /**
   * 선점한 시각(`last_attempt_at`). 결과를 기록할 때 "내가 선점한 그 행"인지 확인하는 펜싱 값이다.
   * 15분이 지나 복구돼 다른 실행이 다시 선점하면 `last_attempt_at`이 달라져, 늦게 끝난 이전 실행의 결과가
   * 새 실행이 선점한 행을 덮지 못한다.
   */
  claimedAt: UtcInstant;
}

type ClaimedRow = Omit<ClaimedNotification, 'claimedAt'>;

/**
 * 도래했고 의미가 있는 `PENDING` 슬롯을 `SENDING`으로 선점해 돌려준다 (SPEC §17 발송 멱등성).
 * 선점은 하나의 `UPDATE … RETURNING`이라 겹쳐 실행돼도 한 행은 한 실행만 가져간다.
 * `trialRecordId`를 주면 그 기록의 슬롯만 가져간다(늦은 등록 즉시 발송).
 */
export async function claimDueNotifications(
  db: D1Database,
  now: UtcInstant,
  today: KstDate,
  limit: number,
  trialRecordId?: string,
): Promise<ClaimedNotification[]> {
  const recordFilter = trialRecordId === undefined ? '' : ' AND n.trial_record_id = ?';
  const { results } = await db
    .prepare(
      `UPDATE notification_schedules
          SET status = 'SENDING', last_attempt_at = ?
        WHERE status = 'PENDING' AND id IN (
                SELECT n.id FROM notification_schedules n
                  JOIN trial_records r ON r.id = n.trial_record_id
                 WHERE n.status = 'PENDING' AND n.send_at <= ?${recordFilter}
                   AND ${meaningfulClause('n', 'r')}
                 ORDER BY n.send_at LIMIT ?)
        RETURNING id, trial_record_id AS trialRecordId, kind, slot, variant`,
    )
    .bind(now, now, ...(trialRecordId === undefined ? [] : [trialRecordId]), today, limit)
    .all<ClaimedRow>();
  return results.map((row) => ({ ...row, claimedAt: now }));
}

/** 발송 대상 기록의 사용자와 카탈로그 항목. 디스패처는 시스템이 하므로 소유 확인 없이 읽는다. 없으면 던진다 */
export async function findDispatchTarget(
  db: D1Database,
  trialRecordId: string,
): Promise<{ userId: string; catalogItemId: string }> {
  const row = await db
    .prepare(
      'SELECT user_id AS userId, catalog_item_id AS catalogItemId FROM trial_records WHERE id = ?',
    )
    .bind(trialRecordId)
    .first<{ userId: string; catalogItemId: string }>();
  // 선점한 행은 기록과 함께 있으므로(FK) 없으면 그 사이 탈퇴 등으로 지워진 것이다. 발송 실패로 다룬다
  if (row === null) throw new Error('발송 대상 기록을 찾을 수 없습니다');
  return row;
}

/** 결과를 기록할 행: 선점한 실행만 자기 행을 닫도록 선점 시각까지 조건으로 건다 (`ClaimedNotification.claimedAt`) */
type OwnedSlot = Pick<ClaimedNotification, 'id' | 'claimedAt'>;

/** 발송이 끝난 행을 닫는다. 이미 소유를 잃은 행이면 아무것도 바꾸지 않는다 */
export async function markSent(db: D1Database, slot: OwnedSlot): Promise<void> {
  await db
    .prepare(
      `UPDATE notification_schedules SET status = 'SENT'
        WHERE id = ? AND status = 'SENDING' AND last_attempt_at = ?`,
    )
    .bind(slot.id, slot.claimedAt)
    .run();
}

/** 수신을 껐거나 수신처가 없어 보내지 않은 행을 닫는다 (SPEC §6 알림 수신 거부) */
export async function markSkipped(db: D1Database, slot: OwnedSlot): Promise<void> {
  await db
    .prepare(
      `UPDATE notification_schedules SET status = 'SKIPPED'
        WHERE id = ? AND status = 'SENDING' AND last_attempt_at = ?`,
    )
    .bind(slot.id, slot.claimedAt)
    .run();
}

/** 발송이 실패한 행: 시도 횟수를 올리고 한도 미만이면 다시 `PENDING`, 한도에 닿으면 `FAILED` (SPEC §17) */
export const MAX_SEND_ATTEMPTS = 3;

/** 소유를 잃은 행(복구돼 다른 실행이 다시 선점)이면 바꾸지 않고 `undefined`를 돌려준다 */
export async function markSendFailed(
  db: D1Database,
  slot: OwnedSlot,
): Promise<'retried' | 'failed' | undefined> {
  const row = await db
    .prepare(
      `UPDATE notification_schedules
          SET attempts = attempts + 1,
              status = CASE WHEN attempts + 1 >= ? THEN 'FAILED' ELSE 'PENDING' END
        WHERE id = ? AND status = 'SENDING' AND last_attempt_at = ?
        RETURNING status`,
    )
    .bind(MAX_SEND_ATTEMPTS, slot.id, slot.claimedAt)
    .first<{ status: 'PENDING' | 'FAILED' }>();
  if (row === null) return undefined;
  return row.status === 'FAILED' ? 'failed' : 'retried';
}

/** `SENDING`으로 이만큼 남은 행은 선점한 실행이 죽은 것으로 본다 (SPEC §17) */
export const SENDING_RECLAIM_MS = 15 * 60 * 1000;

/**
 * 선점한 실행이 끝내지 못한 행을 `PENDING`으로 되돌린다. `last_attempt_at`이 선점 시각이므로
 * 15분을 넘긴 행만 대상이다(SPEC §17 "15분 넘게", 정확히 15분은 아직 아니다). 이 경우에 한해 이미 보냈을 수 있어 중복 발송을 허용한다 (SPEC §17).
 */
export async function reclaimStaleSending(
  db: D1Database,
  now: UtcInstant,
  trialRecordId?: string,
): Promise<number> {
  const cutoff = new Date(Date.parse(now) - SENDING_RECLAIM_MS).toISOString();
  const recordFilter = trialRecordId === undefined ? '' : ' AND trial_record_id = ?';
  const result = await db
    .prepare(
      `UPDATE notification_schedules SET status = 'PENDING'
        WHERE status = 'SENDING' AND last_attempt_at < ?${recordFilter}`,
    )
    .bind(cutoff, ...(trialRecordId === undefined ? [] : [trialRecordId]))
    .run();
  return result.meta.changes;
}

/**
 * 의미를 잃은 `PENDING` 슬롯을 `EXPIRED`로 닫는다 (SPEC §17, architecture §5.6). 상태 전이는 보통 아직 안 보낸
 * 알림을 함께 취소하지만, 배치가 멈췄다 도는 등 어긋난 경우에도 지난 `BillingDate`의 탈출 알림이 나가지 않게 한다.
 * 선점(claim)과 같은 판정이라 닫히는 행은 어차피 선점되지 않는다.
 */
export async function expireMeaninglessPending(
  db: D1Database,
  today: KstDate,
  trialRecordId?: string,
): Promise<number> {
  const recordFilter = trialRecordId === undefined ? '' : ' AND n.trial_record_id = ?';
  const result = await db
    .prepare(
      `UPDATE notification_schedules AS n SET status = 'EXPIRED'
        WHERE n.status = 'PENDING'${recordFilter}
          AND NOT EXISTS (SELECT 1 FROM trial_records r
                           WHERE r.id = n.trial_record_id AND ${meaningfulClause('n', 'r')})`,
    )
    .bind(...(trialRecordId === undefined ? [] : [trialRecordId]), today)
    .run();
  return result.meta.changes;
}
