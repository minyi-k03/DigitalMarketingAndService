import { env } from 'cloudflare:test';

// T14 시점에는 아래 상태·행을 만드는 공개 명령이 아직 없어 테스트 준비·관찰에만 SQL을 쓴다.
// - MISSED_BILLED 전이: T18 배치가 생기면 그 명령으로 바꾼다
// - 알림 슬롯: T16(생성·전이 시 저장)이 생기면 그 명령으로, 관찰은 T17 디스패처로 바꾼다
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

export async function slotStatusesOf(trialRecordId: string) {
  const { results } = await env.DB.prepare(
    'SELECT slot, status FROM notification_schedules WHERE trial_record_id = ? ORDER BY slot',
  )
    .bind(trialRecordId)
    .all<{ slot: string; status: string }>();
  return results;
}
