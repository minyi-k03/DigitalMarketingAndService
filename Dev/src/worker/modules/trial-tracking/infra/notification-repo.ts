import type { KstDate } from '../../../../shared/kst-date';
import { newId } from '../../../platform/id';
import type { NotificationKind, PlannedSlot } from '../domain/notification-planner';
import type { TrialStatus } from './trial-repo';

export type { NotificationKind };

/**
 * 알림을 바꿀 때 같은 batch의 앞선 UPDATE가 기록에 반영됐는지 확인하는 조건. 상태 전이는 상태로, 날짜 수정은
 * 상태와 새 `safeEndDate`로 확인한다. 동시 요청에 밀려 앞선 UPDATE가 0행이면 조건이 맞지 않아 알림도 그대로다.
 */
export type RecordGuard = TrialStatus | { status: TrialStatus; safeEndDate: KstDate };

function guardClause(trialRecordId: string, guard: RecordGuard) {
  const { status, safeEndDate } =
    typeof guard === 'string' ? { status: guard, safeEndDate: undefined } : guard;
  return {
    sql: `EXISTS (SELECT 1 FROM trial_records WHERE id = ? AND status = ?${
      safeEndDate === undefined ? '' : ' AND safe_end_date = ?'
    })`,
    params: [trialRecordId, status, ...(safeEndDate === undefined ? [] : [safeEndDate])],
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
