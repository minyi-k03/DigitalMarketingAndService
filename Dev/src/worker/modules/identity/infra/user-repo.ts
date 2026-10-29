export interface UserRef {
  id: string;
  role: 'USER' | 'OPERATOR' | 'ADMIN';
}

export interface UserRow extends UserRef {
  nickname: string | null;
  notificationEnabled: number;
  notificationConsentAt: string | null;
  phoneNumberEncrypted: string | null;
}

export async function findUserById(db: D1Database, userId: string): Promise<UserRow | null> {
  return db
    .prepare(
      `SELECT id, role, nickname,
              notification_enabled AS notificationEnabled,
              notification_consent_at AS notificationConsentAt,
              phone_number_encrypted AS phoneNumberEncrypted
       FROM users WHERE id = ?`,
    )
    .bind(userId)
    .first<UserRow>();
}

/**
 * 카카오 계정으로 사용자를 만들거나 닉네임을 갱신한다.
 * 신규 사용자는 알림 수신 기본값 켜짐, 역할 USER로 만든다 (SPEC §15).
 */
export async function upsertUserByKakaoId(
  db: D1Database,
  input: { newId: string; kakaoId: string; nickname?: string; nowIso: string },
): Promise<UserRef> {
  const row = await db
    .prepare(
      `INSERT INTO users (id, kakao_id, nickname, notification_enabled, role, created_at)
       VALUES (?, ?, ?, 1, 'USER', ?)
       ON CONFLICT (kakao_id) DO UPDATE SET nickname = COALESCE(excluded.nickname, users.nickname)
       RETURNING id, role`,
    )
    .bind(input.newId, input.kakaoId, input.nickname ?? null, input.nowIso)
    .first<UserRef>();
  if (!row) throw new Error('사용자 upsert 결과가 없습니다');
  return row;
}
