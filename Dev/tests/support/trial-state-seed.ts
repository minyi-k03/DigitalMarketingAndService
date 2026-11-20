import { env } from 'cloudflare:test';

// T14 시점에는 아래 상태·행을 만드는 공개 명령이 아직 없어 테스트 준비·관찰에만 SQL을 쓴다.
// - MISSED_BILLED 전이: T18 배치(`runMissedBilledBatch`)가 생겼지만, 정정·수정 테스트는 전이 시각과 알림 없는 상태를
//   직접 정해야 해서 이 헬퍼를 유지한다. 배치 자체의 동작은 `missed-billed-batch.test.ts`가 검증한다
// - 알림 슬롯: 생성·사유 선택·기록 수정의 저장은 T16 명령이 한다. 여기 SQL은 결제 확인 알림(T18 전)과 발송 결과 흉내
//   (SENT 등)를 준비하고 저장된 행을 관찰하는 데만 쓴다. 발송 결과는 T17 디스패처가 만들지만 T16 테스트가 "이미 보낸 행"을
//   직접 만들어 쓰고, 관찰은 알림 조회 명령이 생기기 전까지 SQL로 한다
// - ExitPoll 응답 원본: 공개 조회는 발표용 집계(T62)뿐이라 불변식(기록당 정확히 1건) 확인에만 직접 읽는다

/** BillingDate 경과 배치(T18)가 한 일을 흉내 낸다. 응답이 있던 CANCEL_ATTEMPTED 기록은 응답을 보존한다 */
export async function forceMissedBilled(trialRecordId: string, at: string) {
  await env.DB.prepare(
    "UPDATE trial_records SET status = 'MISSED_BILLED', status_changed_at = ? WHERE id = ?",
  )
    .bind(at, trialRecordId)
    .run();
}

export async function exitPollResponsesOf(trialRecordId: string) {
  const { results } = await env.DB.prepare(
    'SELECT catalog_item_id, service_category, reason, responded_at FROM exit_poll_responses WHERE trial_record_id = ?',
  )
    .bind(trialRecordId)
    .all<{
      catalog_item_id: string;
      service_category: string;
      reason: string;
      responded_at: string;
    }>();
  return results;
}

/** 응답 원본만 미리 넣어 batch 안의 INSERT가 PK 충돌로 실패하게 만든다 (architecture §5.3 롤백 확인) */
export async function insertOrphanExitPoll(trialRecordId: string, catalogItemId: string) {
  await env.DB.prepare(
    `INSERT INTO exit_poll_responses (trial_record_id, catalog_item_id, service_category, reason, responded_at)
     VALUES (?, ?, 'OTT', 'PRICE_BURDEN', '2026-11-01T00:00:00.000Z')`,
  )
    .bind(trialRecordId, catalogItemId)
    .run();
}

export async function insertPendingSlot(
  trialRecordId: string,
  slot: 'D3' | 'D1' | 'D1_CONFIRM' | 'BILLING_CHECK',
  safeEndDate: string,
  sendAt: string,
) {
  const kind =
    slot === 'D1_CONFIRM'
      ? 'CANCEL_CONFIRM_CHECK'
      : slot === 'BILLING_CHECK'
        ? 'BILLING_CHECK'
        : 'ESCAPE_ALERT';
  await env.DB.prepare(
    `INSERT INTO notification_schedules (id, trial_record_id, kind, slot, variant, safe_end_date, send_at, status)
     VALUES (?, ?, ?, ?, 'REGULAR', ?, ?, 'PENDING')`,
  )
    .bind(crypto.randomUUID(), trialRecordId, kind, slot, safeEndDate, sendAt)
    .run();
}

/** 저장된 알림 행 전체. 알림 조회 명령이 생기기 전까지 SQL로 관찰한다 */
export async function slotsOf(trialRecordId: string) {
  const { results } = await env.DB.prepare(
    `SELECT kind, slot, variant, safe_end_date AS safeEndDate, send_at AS sendAt, status
       FROM notification_schedules WHERE trial_record_id = ? ORDER BY send_at, slot`,
  )
    .bind(trialRecordId)
    .all<{
      kind: string;
      slot: string;
      variant: string;
      safeEndDate: string;
      sendAt: string;
      status: string;
    }>();
  return results;
}

/** 발송 결과를 흉내 낸다. T16 테스트가 "이미 보낸·실패한 행"을 만들 때 쓴다 */
export async function markSlot(
  trialRecordId: string,
  slot: string,
  status: 'SENT' | 'FAILED' | 'EXPIRED' | 'SKIPPED',
) {
  await env.DB.prepare(
    'UPDATE notification_schedules SET status = ? WHERE trial_record_id = ? AND slot = ?',
  )
    .bind(status, trialRecordId, slot)
    .run();
}

/** 발송 시도 횟수를 흉내 낸다. 재예약으로 되살릴 때 초기화되는지 확인하는 데 쓴다 */
export async function setSlotAttempts(trialRecordId: string, slot: string, attempts: number) {
  await env.DB.prepare(
    `UPDATE notification_schedules SET attempts = ?, last_attempt_at = '2026-11-04T00:00:00.000Z'
      WHERE trial_record_id = ? AND slot = ?`,
  )
    .bind(attempts, trialRecordId, slot)
    .run();
}

export async function slotAttemptsOf(trialRecordId: string, slot: string) {
  return env.DB.prepare(
    `SELECT attempts, last_attempt_at AS lastAttemptAt
       FROM notification_schedules WHERE trial_record_id = ? AND slot = ?`,
  )
    .bind(trialRecordId, slot)
    .first<{ attempts: number; lastAttemptAt: string | null }>();
}

/** 기본 발송 시각 설정(`notification.sendTime`)을 바꾼다. 설정 화면(T12)은 발표 범위 밖이라 SQL로 바꾼다 */
export async function setSendTimeSetting(rawJson: string) {
  await env.DB.prepare("UPDATE app_settings SET value = ? WHERE key = 'notification.sendTime'")
    .bind(rawJson)
    .run();
}

export async function slotStatusesOf(trialRecordId: string) {
  const { results } = await env.DB.prepare(
    'SELECT slot, status FROM notification_schedules WHERE trial_record_id = ? ORDER BY slot',
  )
    .bind(trialRecordId)
    .all<{ slot: string; status: string }>();
  return results;
}

/** 선점만 하고 끝내지 못한(Worker가 중간에 죽은) 실행을 흉내 낸다. 복구 규칙(T17) 확인에 쓴다 */
export async function markSending(trialRecordId: string, slot: string, lastAttemptAt: string) {
  await env.DB.prepare(
    `UPDATE notification_schedules SET status = 'SENDING', last_attempt_at = ?
      WHERE trial_record_id = ? AND slot = ?`,
  )
    .bind(lastAttemptAt, trialRecordId, slot)
    .run();
}
