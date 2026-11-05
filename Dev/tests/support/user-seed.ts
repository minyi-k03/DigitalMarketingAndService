import { env } from 'cloudflare:test';

/** trial_records 등이 참조하는 사용자 행을 만든다. 로그인 없이 application 계층을 시험할 때 쓴다 */
export async function insertUser(id: string = crypto.randomUUID()): Promise<string> {
  await env.DB.prepare(
    `INSERT INTO users (id, kakao_id, nickname, notification_enabled, role, created_at)
     VALUES (?, ?, '테스터', 1, 'USER', '2026-11-01T00:00:00.000Z')`,
  )
    .bind(id, `kakao-${id}`)
    .run();
  return id;
}
