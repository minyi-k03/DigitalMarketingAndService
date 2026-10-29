import type { UserRef } from './user-repo';

export interface SessionRow extends UserRef {
  expiresAt: string;
}

export async function insertSession(
  db: D1Database,
  input: { tokenHash: string; userId: string; expiresAt: string; createdAt: string },
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    )
    .bind(input.tokenHash, input.userId, input.expiresAt, input.createdAt)
    .run();
}

export async function findSession(db: D1Database, tokenHash: string): Promise<SessionRow | null> {
  return db
    .prepare(
      `SELECT u.id AS id, u.role AS role, s.expires_at AS expiresAt
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`,
    )
    .bind(tokenHash)
    .first<SessionRow>();
}

export async function deleteSession(db: D1Database, tokenHash: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
}
