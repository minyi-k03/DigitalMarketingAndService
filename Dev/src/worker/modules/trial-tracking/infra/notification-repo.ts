import type { TrialStatus } from './trial-repo';

export type NotificationKind = 'ESCAPE_ALERT' | 'CANCEL_CONFIRM_CHECK' | 'BILLING_CHECK';

/**
 * 기록의 `PENDING` 알림을 `CANCELED`로 바꾼다 (SPEC §6 알림 취소). `kinds`를 주면 그 종류만 취소한다.
 * 같은 batch에서 앞선 조건부 UPDATE가 기록을 `expectedStatus`로 바꿨을 때만 반영되므로,
 * 동시 요청에 밀려 전이가 0행이면 알림도 그대로 남는다.
 */
export function preparePendingSlotCancel(
  db: D1Database,
  trialRecordId: string,
  expectedStatus: TrialStatus,
  kinds?: readonly NotificationKind[],
): D1PreparedStatement {
  const kindFilter = kinds === undefined ? '' : ` AND kind IN (${kinds.map(() => '?').join(', ')})`;
  return db
    .prepare(
      `UPDATE notification_schedules SET status = 'CANCELED'
        WHERE trial_record_id = ? AND status = 'PENDING'${kindFilter}
          AND EXISTS (SELECT 1 FROM trial_records WHERE id = ? AND status = ?)`,
    )
    .bind(trialRecordId, ...(kinds ?? []), trialRecordId, expectedStatus);
}
