import { env } from 'cloudflare:test';
import { createApp } from '../../src/worker/http/app';
import type { Logger } from '../../src/worker/http/logger';
import { createIdentityService } from '../../src/worker/modules/identity';
import { FakeClock } from './fake-clock';
import { FakeKakaoOAuthClient } from './fake-kakao-oauth';

export const ORIGIN = 'http://localhost';
const silentLogger: Logger = { info: () => {}, error: () => {} };

/** 가짜 카카오와 실제 D1로 조립한 앱. 로그인 헬퍼와 함께 쓴다 */
export function buildLoginApp() {
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  const kakao = new FakeKakaoOAuthClient();
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao,
    sessionSigningKey: 'test-session-signing-key',
    tokenEncryptionKey: btoa('0123456789abcdef0123456789abcdef'),
  });
  const app = createApp({ clock, db: env.DB, logger: silentLogger, identity });
  return { app, clock, kakao, identity };
}

type LoginApp = ReturnType<typeof buildLoginApp>;

/** 로그인 시작부터 콜백까지 진행하고 세션 쿠키(`sc_session=…`)와 사용자 id를 돌려준다 */
export async function loginAs(
  { app, kakao, identity }: LoginApp,
  { kakaoId }: { kakaoId: string },
) {
  const code = `code-${kakaoId}`;
  kakao.grant(code, { kakaoId, nickname: '테스터' });

  const start = await app.request(`${ORIGIN}/auth/kakao/login`);
  const state = new URL(start.headers.get('Location') ?? '').searchParams.get('state') ?? '';
  const nonceCookie = (start.headers.get('Set-Cookie') ?? '').split(';')[0] ?? '';
  const callback = await app.request(
    `${ORIGIN}/auth/kakao/callback?code=${code}&state=${encodeURIComponent(state)}`,
    { headers: { Cookie: nonceCookie } },
  );
  const sessionLine = callback.headers.getSetCookie().find((c) => c.startsWith('sc_session='));
  const cookie = sessionLine?.split(';')[0] ?? '';
  const user = await identity.authenticate(cookie.replace('sc_session=', ''));
  return { cookie, userId: user!.userId };
}
