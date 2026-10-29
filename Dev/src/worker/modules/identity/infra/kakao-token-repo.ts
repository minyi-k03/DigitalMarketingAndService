export interface KakaoTokenRow {
  refreshTokenEncrypted: string;
  refreshTokenExpiresAt: string;
  scopes: string[];
}

export async function upsertKakaoToken(
  db: D1Database,
  input: {
    userId: string;
    refreshTokenEncrypted: string;
    refreshTokenExpiresAt: string;
    scopes: string[];
    updatedAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO kakao_message_tokens
         (user_id, refresh_token_encrypted, refresh_token_expires_at, scopes, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         refresh_token_encrypted = excluded.refresh_token_encrypted,
         refresh_token_expires_at = excluded.refresh_token_expires_at,
         scopes = excluded.scopes,
         updated_at = excluded.updated_at`,
    )
    .bind(
      input.userId,
      input.refreshTokenEncrypted,
      input.refreshTokenExpiresAt,
      JSON.stringify(input.scopes),
      input.updatedAt,
    )
    .run();
}

export async function findKakaoToken(
  db: D1Database,
  userId: string,
): Promise<KakaoTokenRow | null> {
  const row = await db
    .prepare(
      `SELECT refresh_token_encrypted AS refreshTokenEncrypted,
              refresh_token_expires_at AS refreshTokenExpiresAt,
              scopes
       FROM kakao_message_tokens WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ refreshTokenEncrypted: string; refreshTokenExpiresAt: string; scopes: string }>();
  if (!row) return null;
  return { ...row, scopes: JSON.parse(row.scopes) as string[] };
}

export async function replaceRefreshToken(
  db: D1Database,
  input: {
    userId: string;
    refreshTokenEncrypted: string;
    refreshTokenExpiresAt: string;
    updatedAt: string;
  },
): Promise<void> {
  await db
    .prepare(
      `UPDATE kakao_message_tokens
       SET refresh_token_encrypted = ?, refresh_token_expires_at = ?, updated_at = ?
       WHERE user_id = ?`,
    )
    .bind(input.refreshTokenEncrypted, input.refreshTokenExpiresAt, input.updatedAt, input.userId)
    .run();
}
