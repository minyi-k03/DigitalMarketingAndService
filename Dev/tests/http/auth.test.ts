import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/worker/http/app';
import type { Logger } from '../../src/worker/http/logger';
import { createIdentityService } from '../../src/worker/modules/identity';
import { FakeClock } from '../support/fake-clock';
import { FakeKakaoOAuthClient } from '../support/fake-kakao-oauth';

const ORIGIN = 'http://localhost';
const silentLogger: Logger = { info: () => {}, error: () => {} };

function buildApp() {
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

type Built = ReturnType<typeof buildApp>;

/** 로그인 시작 → 콜백까지 진행하고 세션 쿠키 값을 돌려준다 */
async function loginAndGetCookie(
  { app, kakao }: Built,
  options: { code: string; kakaoId: string; returnTo?: string },
) {
  kakao.grant(options.code, { kakaoId: options.kakaoId, nickname: '민지' });
  const query = options.returnTo ? `?returnTo=${encodeURIComponent(options.returnTo)}` : '';
  const { state, nonceCookie } = await startLogin(app, query);
  const callback = await app.request(
    `${ORIGIN}/auth/kakao/callback?code=${options.code}&state=${encodeURIComponent(state)}`,
    { headers: { Cookie: nonceCookie } },
  );
  const setCookie = sessionSetCookie(callback);
  return { callback, setCookie, cookie: setCookie.split(';')[0] ?? '' };
}

/** 로그인 시작 응답에서 카카오로 보낸 state와, 브라우저가 보관할 nonce 쿠키를 꺼낸다 */
async function startLogin(app: Built['app'], query = '') {
  const start = await app.request(`${ORIGIN}/auth/kakao/login${query}`);
  const state = new URL(start.headers.get('Location') ?? '').searchParams.get('state') ?? '';
  const nonceSetCookie = start.headers.get('Set-Cookie') ?? '';
  return { start, state, nonceSetCookie, nonceCookie: nonceSetCookie.split(';')[0] ?? '' };
}

/** 응답의 Set-Cookie 중 세션 쿠키 줄만 돌려준다 */
function sessionSetCookie(res: Response): string {
  return res.headers.getSetCookie().find((c) => c.startsWith('sc_session=')) ?? '';
}

describe('IA 카카오 로그인 HTTP 계약 [S16][T05]', () => {
  it('GET /auth/kakao/login은 카카오 인가 화면으로 302 이동하고 콜백 주소는 자기 도메인이다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/auth/kakao/login?returnTo=%2Fbridge%2Ftr_1`);

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('Location') ?? '');
    expect(location.origin).toBe('https://kakao.test');
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/kakao/callback`);
  });

  it('로그인 시작은 nonce를 짧은 수명의 HttpOnly 쿠키로 심는다 [로그인 CSRF]', async () => {
    const { app } = buildApp();

    const { nonceSetCookie } = await startLogin(app);

    expect(nonceSetCookie).toMatch(/^sc_login_nonce=[\w-]{16,};/);
    expect(nonceSetCookie).toMatch(/HttpOnly/i);
    expect(nonceSetCookie).toMatch(/Secure/i);
    expect(nonceSetCookie).toMatch(/SameSite=Lax/i);
    expect(nonceSetCookie).toMatch(/Max-Age=600/);
    expect(nonceSetCookie).toMatch(/Path=\/auth\/kakao/);
  });

  it('nonce 쿠키가 없는 브라우저의 콜백은 400이고 세션을 발급하지 않는다 [로그인 CSRF]', async () => {
    const { app, kakao } = buildApp();
    kakao.grant('attacker-code', { kakaoId: '9001' });
    const { state } = await startLogin(app);

    const res = await app.request(
      `${ORIGIN}/auth/kakao/callback?code=attacker-code&state=${encodeURIComponent(state)}`,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(sessionSetCookie(res)).toBe('');
  });

  it('다른 로그인 시도의 nonce 쿠키로는 콜백을 완료하지 못한다 [로그인 CSRF]', async () => {
    const { app, kakao } = buildApp();
    kakao.grant('attacker-code', { kakaoId: '9001' });
    const attacker = await startLogin(app);
    const victim = await startLogin(app);

    const res = await app.request(
      `${ORIGIN}/auth/kakao/callback?code=attacker-code&state=${encodeURIComponent(attacker.state)}`,
      { headers: { Cookie: victim.nonceCookie } },
    );

    expect(res.status).toBe(400);
    expect(sessionSetCookie(res)).toBe('');
  });

  it('로그인이 끝나면 nonce 쿠키를 지운다', async () => {
    const built = buildApp();

    const { callback } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });

    const cleared = callback.headers
      .getSetCookie()
      .find((c) => c.startsWith('sc_login_nonce='));
    expect(cleared).toMatch(/Max-Age=0/);
    expect(cleared).toMatch(/Path=\/auth\/kakao/);
  });

  it('외부 URL returnTo는 400 VALIDATION_FAILED로 거부한다', async () => {
    const { app } = buildApp();

    const res = await app.request(
      `${ORIGIN}/auth/kakao/login?returnTo=${encodeURIComponent('https://evil.example')}`,
    );

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('콜백은 세션 쿠키를 발급하고 returnTo로 이동한다', async () => {
    const built = buildApp();

    const { callback, setCookie } = await loginAndGetCookie(built, {
      code: 'c1',
      kakaoId: '1001',
      returnTo: '/bridge/tr_1',
    });
    expect(callback.status).toBe(302);

    expect(callback.status).toBe(302);
    expect(callback.headers.get('Location')).toBe('/bridge/tr_1');
    expect(setCookie).toMatch(/^sc_session=[\w-]{20,};/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/Secure/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Max-Age=2592000/);
    expect(setCookie).toMatch(/Path=\//);
  });

  it('returnTo가 없으면 /로 이동한다', async () => {
    const built = buildApp();

    const { callback } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });

    expect(callback.headers.get('Location')).toBe('/');
  });

  it.each([
    ['code가 없음', '?state=abc'],
    ['state가 없음', '?code=abc'],
    ['쿼리가 없음', ''],
    ['위조된 state', '?code=abc&state=forged.state'],
  ])('콜백 입력이 잘못되면 400 VALIDATION_FAILED다: %s', async (_name, query) => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/auth/kakao/callback${query}`);

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  // 카카오는 사용자가 동의 화면에서 취소하면 code 없이 ?error=access_denied로 돌려보낸다
  it('동의 화면에서 취소하면 JSON 오류 대신 /로 돌려보내고 세션을 만들지 않는다', async () => {
    const { app } = buildApp();
    const { state, nonceCookie } = await startLogin(app);

    const res = await app.request(
      `${ORIGIN}/auth/kakao/callback?error=access_denied&error_description=user%20denied&state=${encodeURIComponent(state)}`,
      { headers: { Cookie: nonceCookie } },
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/?loginError=access_denied');
    expect(sessionSetCookie(res)).toBe('');
    expect(res.headers.getSetCookie().find((c) => c.startsWith('sc_login_nonce='))).toMatch(
      /Max-Age=0/,
    );
  });

  it('알 수 없는 error 값은 그대로 반사하지 않고 failed로 돌려보낸다', async () => {
    const { app } = buildApp();

    const res = await app.request(
      `${ORIGIN}/auth/kakao/callback?error=${encodeURIComponent('<script>alert(1)</script>')}`,
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/?loginError=failed');
  });

  it('올바르지 않은 인가 코드는 400이고 쿠키를 발급하지 않는다', async () => {
    const { app } = buildApp();
    const { state, nonceCookie } = await startLogin(app);

    const res = await app.request(
      `${ORIGIN}/auth/kakao/callback?code=unknown&state=${encodeURIComponent(state)}`,
      { headers: { Cookie: nonceCookie } },
    );

    expect(res.status).toBe(400);
    expect(sessionSetCookie(res)).toBe('');
  });
});

describe('IA 세션 보호 API HTTP 계약 [S16][T05]', () => {
  it('세션 없이 보호 API를 부르면 401 UNAUTHENTICATED와 returnTo가 담긴 loginUrl을 받는다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/api/me`);

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: '/auth/kakao/login?returnTo=%2Fapi%2Fme',
    });
  });

  it('세션은 유효한데 사용자가 사라진 경우에도 loginUrl이 담긴 401이다', async () => {
    const built = buildApp();
    const { cookie } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });
    const orphaned = createApp({
      clock: built.clock,
      db: env.DB,
      logger: silentLogger,
      identity: { ...built.identity, getMe: async () => null },
    });

    const res = await orphaned.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: '/auth/kakao/login?returnTo=%2Fapi%2Fme',
    });
  });

  it('알 수 없는 세션 쿠키도 401이다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/api/me`, { headers: { Cookie: 'sc_session=bogus' } });

    expect(res.status).toBe(401);
  });

  it('로그인 후 GET /api/me는 내 계정 정보를 돌려준다', async () => {
    const built = buildApp();
    const { cookie } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });

    const res = await built.app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      nickname: '민지',
      role: 'USER',
      notificationEnabled: true,
      hasRecipient: false,
    });
  });

  it('만료된 세션은 401이다', async () => {
    const built = buildApp();
    const { cookie } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });

    built.clock.advanceBy(30 * 24 * 60 * 60 * 1000);
    const res = await built.app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(401);
  });

  it('POST /auth/logout은 204로 쿠키를 지우고 세션을 무효화한다', async () => {
    const built = buildApp();
    const { cookie } = await loginAndGetCookie(built, { code: 'c1', kakaoId: '1001' });

    const res = await built.app.request(`${ORIGIN}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: ORIGIN },
    });
    const after = await built.app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toMatch(/sc_session=;/);
    expect(res.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
    expect(after.status).toBe(401);
  });

  it('세션이 없어도 로그아웃은 204다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/auth/logout`, {
      method: 'POST',
      headers: { Origin: ORIGIN },
    });

    expect(res.status).toBe(204);
  });
});
