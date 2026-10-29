import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createIdentityService } from '../../src/worker/modules/identity';
import { DomainError } from '../../src/worker/platform/errors';
import { FakeClock } from '../support/fake-clock';
import { FakeKakaoOAuthClient } from '../support/fake-kakao-oauth';

const REDIRECT_URI = 'https://subcut.test/auth/kakao/callback';
// 테스트용 키: AES-256(32바이트)을 base64로 표현한 값과 HMAC 키
const TOKEN_KEY = btoa('0123456789abcdef0123456789abcdef');
const SIGNING_KEY = 'test-session-signing-key';

function setup() {
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  const kakao = new FakeKakaoOAuthClient();
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao,
    sessionSigningKey: SIGNING_KEY,
    tokenEncryptionKey: TOKEN_KEY,
  });
  return { clock, kakao, identity };
}

type Setup = ReturnType<typeof setup>;

/** 로그인을 시작해 카카오로 보낼 state와, 브라우저 쿠키에 심을 nonce를 돌려준다 */
async function startFlow(identity: Setup['identity'], returnTo?: string) {
  const { authorizeUrl, nonce } = await identity.startKakaoLogin({
    returnTo,
    redirectUri: REDIRECT_URI,
  });
  return { state: new URL(authorizeUrl).searchParams.get('state') ?? '', nonce };
}

/** 로그인 시작부터 카카오 콜백 도착까지의 입력을 만든다 */
async function callbackFor(identity: Setup['identity'], code: string, returnTo?: string) {
  const { state, nonce } = await startFlow(identity, returnTo);
  return { code, state, nonce, redirectUri: REDIRECT_URI };
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => null,
    (e: unknown) => e,
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

describe('IA 카카오 로그인 시작 [S16][T05]', () => {
  it('카카오 인가 URL을 돌려주고 state에 서명된 값이 담긴다', async () => {
    const { identity } = setup();

    const { authorizeUrl } = await identity.startKakaoLogin({
      returnTo: '/bridge/tr_1',
      redirectUri: REDIRECT_URI,
    });

    const url = new URL(authorizeUrl);
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('state')).toMatch(/^[\w-]+\.[\w-]+$/);
  });

  it('returnTo가 없으면 기본 경로로 시작한다', async () => {
    const { identity } = setup();

    await expect(identity.startKakaoLogin({ redirectUri: REDIRECT_URI })).resolves.toBeDefined();
  });

  it('시작할 때마다 서로 다른 nonce를 돌려준다 (브라우저 쿠키에 묶는 용도)', async () => {
    const { identity } = setup();

    const a = await startFlow(identity);
    const b = await startFlow(identity);

    expect(a.nonce).toMatch(/^[\w-]{16,}$/);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it.each([
    ['외부 URL', 'https://evil.example/phish'],
    ['프로토콜 상대 경로', '//evil.example'],
    ['백슬래시 우회', '/\\evil.example'],
    ['슬래시로 시작하지 않는 경로', 'bridge/tr_1'],
    ['줄바꿈 포함', '/bridge/tr_1\r\nSet-Cookie: x=1'],
    ['빈 문자열', ''],
  ])('외부로 나가는 returnTo는 거부한다: %s', async (_name, returnTo) => {
    const { identity } = setup();

    const error = await identity.startKakaoLogin({ returnTo, redirectUri: REDIRECT_URI }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
  });
});

describe('IA 카카오 로그인 완료와 세션 [S16][T05]', () => {
  it('로그인하면 세션이 발급되고 state에 담긴 returnTo로 돌아간다', async () => {
    const { identity, kakao } = setup();
    kakao.grant('code-1', { kakaoId: '1001', nickname: '민지' });

    const result = await identity.loginWithKakao(
      await callbackFor(identity, 'code-1', '/bridge/tr_1'),
    );

    expect(result.returnTo).toBe('/bridge/tr_1');
    expect(result.expiresAt).toBe('2026-12-02T01:00:00.000Z');
    expect(await identity.authenticate(result.sessionToken)).toMatchObject({ role: 'USER' });
  });

  it('returnTo를 생략하면 /로 돌아간다', async () => {
    const { identity, kakao } = setup();
    kakao.grant('code-1', { kakaoId: '1001' });

    const result = await identity.loginWithKakao(await callbackFor(identity, 'code-1'));

    expect(result.returnTo).toBe('/');
  });

  it('세션 토큰 원문은 저장하지 않고 SHA-256 해시만 저장한다', async () => {
    const { identity, kakao } = setup();
    kakao.grant('code-hash', { kakaoId: '2001' });

    const { sessionToken } = await identity.loginWithKakao(
      await callbackFor(identity, 'code-hash'),
    );

    const { results } = await env.DB.prepare('SELECT token_hash FROM sessions').all<{
      token_hash: string;
    }>();
    const hashes = results.map((r) => r.token_hash);
    expect(hashes).not.toContain(sessionToken);
    expect(hashes.every((h) => /^[0-9a-f]{64}$/.test(h))).toBe(true);
  });

  it('같은 카카오 계정으로 다시 로그인하면 같은 사용자의 새 세션이다', async () => {
    const { identity, kakao } = setup();
    kakao.grant('first', { kakaoId: '3001', nickname: '이전 닉네임' });
    kakao.grant('second', { kakaoId: '3001', nickname: '새 닉네임' });

    const a = await identity.loginWithKakao(await callbackFor(identity, 'first'));
    const b = await identity.loginWithKakao(await callbackFor(identity, 'second'));

    expect(a.sessionToken).not.toBe(b.sessionToken);
    expect((await identity.authenticate(a.sessionToken))?.userId).toBe(
      (await identity.authenticate(b.sessionToken))?.userId,
    );
  });

  it('다른 카카오 계정은 다른 사용자다', async () => {
    const { identity, kakao } = setup();
    kakao.grant('u1', { kakaoId: '4001' });
    kakao.grant('u2', { kakaoId: '4002' });

    const a = await identity.loginWithKakao(await callbackFor(identity, 'u1'));
    const b = await identity.loginWithKakao(await callbackFor(identity, 'u2'));

    expect((await identity.authenticate(a.sessionToken))?.userId).not.toBe(
      (await identity.authenticate(b.sessionToken))?.userId,
    );
  });

  it.each([
    ['형식이 잘못된 state', () => 'not-a-state'],
    ['빈 state', () => ''],
    [
      '서명이 바뀐 state',
      (state: string) => `${state.split('.')[0]}.${'A'.repeat(state.split('.')[1]?.length ?? 1)}`,
    ],
    [
      '본문(returnTo)이 바뀐 state',
      (state: string) => {
        const [, signature] = state.split('.');
        const forged = btoa(JSON.stringify({ n: 'x', r: '/admin', e: 9999999999999 }))
          .replaceAll('=', '')
          .replaceAll('+', '-')
          .replaceAll('/', '_');
        return `${forged}.${signature}`;
      },
    ],
  ])('위조된 state는 거부한다: %s', async (_name, tamper) => {
    const { identity, kakao } = setup();
    kakao.grant('code-1', { kakaoId: '1001' });
    const flow = await startFlow(identity, '/bridge/tr_1');

    const error = await rejectionOf(
      identity.loginWithKakao({
        code: 'code-1',
        state: tamper(flow.state),
        nonce: flow.nonce,
        redirectUri: REDIRECT_URI,
      }),
    );

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
  });

  it('10분이 지난 state는 거부한다', async () => {
    const { identity, kakao, clock } = setup();
    kakao.grant('code-1', { kakaoId: '1001' });
    const input = await callbackFor(identity, 'code-1');

    clock.advanceBy(10 * 60 * 1000 + 1);
    const error = await rejectionOf(identity.loginWithKakao(input));

    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
  });

  it('올바르지 않은 인가 코드는 거부한다', async () => {
    const { identity } = setup();

    const error = await rejectionOf(
      identity.loginWithKakao(await callbackFor(identity, 'unknown-code')),
    );

    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
  });

  // 로그인 CSRF: 공격자가 자기 계정의 code와 자기가 받은 유효 state를 피해자 브라우저로 열게 해도,
  // 피해자 브라우저에는 그 state의 nonce 쿠키가 없으므로 완료할 수 없어야 한다.
  it('state와 함께 시작된 브라우저의 nonce가 아니면 로그인을 완료하지 못한다 [로그인 CSRF]', async () => {
    const { identity, kakao } = setup();
    kakao.grant('attacker-code', { kakaoId: '9001' });
    const attackerFlow = await startFlow(identity);
    const victimFlow = await startFlow(identity);

    const error = await rejectionOf(
      identity.loginWithKakao({
        code: 'attacker-code',
        state: attackerFlow.state,
        nonce: victimFlow.nonce,
        redirectUri: REDIRECT_URI,
      }),
    );

    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
    const { results } = await env.DB.prepare(
      "SELECT id FROM users WHERE kakao_id = '9001'",
    ).all();
    expect(results).toHaveLength(0);
  });

  it('nonce 없이(쿠키 없이) 완료하려 하면 거부한다 [로그인 CSRF]', async () => {
    const { identity, kakao } = setup();
    kakao.grant('code-1', { kakaoId: '1001' });
    const { state } = await startFlow(identity);

    const error = await rejectionOf(
      identity.loginWithKakao({
        code: 'code-1',
        state,
        nonce: undefined,
        redirectUri: REDIRECT_URI,
      }),
    );

    expect((error as DomainError).code).toBe('VALIDATION_FAILED');
  });
});

describe('IA 세션 인증과 로그아웃 [S16][T05]', () => {
  async function login(s: Setup, code = 'code-1', kakaoId = '1001') {
    s.kakao.grant(code, { kakaoId });
    return s.identity.loginWithKakao(await callbackFor(s.identity, code));
  }

  it('없는 세션 토큰과 토큰 없음은 인증되지 않는다', async () => {
    const { identity } = setup();

    expect(await identity.authenticate('no-such-token')).toBeNull();
    expect(await identity.authenticate(undefined)).toBeNull();
    expect(await identity.authenticate('')).toBeNull();
  });

  it('만료 직전(30일 이내)에는 인증되고 만료 시각이 지나면 거부한다', async () => {
    const s = setup();
    const { sessionToken } = await login(s);

    s.clock.advanceBy(30 * DAY_MS - 1000);
    expect(await s.identity.authenticate(sessionToken)).not.toBeNull();

    s.clock.advanceBy(1000);
    expect(await s.identity.authenticate(sessionToken)).toBeNull();
  });

  it('로그아웃하면 그 세션만 무효가 된다', async () => {
    const s = setup();
    const first = await login(s, 'c1', '1001');
    const other = await login(s, 'c2', '1001');

    await s.identity.logout(first.sessionToken);

    expect(await s.identity.authenticate(first.sessionToken)).toBeNull();
    expect(await s.identity.authenticate(other.sessionToken)).not.toBeNull();
  });

  it('없는 세션을 로그아웃해도 오류가 없다', async () => {
    const { identity } = setup();

    await expect(identity.logout('no-such-token')).resolves.toBeUndefined();
    await expect(identity.logout(undefined)).resolves.toBeUndefined();
  });
});

describe('IA 카카오 메시지 토큰 [D-16][V-10][T05]', () => {
  const TALK = ['profile_nickname', 'talk_message'];

  async function loginWithScopes(s: Setup, code: string, scopes: string[], kakaoId = '5001') {
    s.kakao.grant(code, { kakaoId, nickname: '민지' }, scopes);
    const { sessionToken } = await s.identity.loginWithKakao(await callbackFor(s.identity, code));
    const user = await s.identity.authenticate(sessionToken);
    return user!.userId;
  }

  it('저장된 refresh token으로 access token을 갱신해 돌려준다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-a', TALK);

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBe('access-from-refresh-code-a');
    expect(s.kakao.refreshCalls).toEqual(['refresh-code-a']);
  });

  it('refresh token은 암호화해 저장하고 원문은 저장하지 않는다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-secret', TALK);

    const row = await env.DB.prepare(
      'SELECT refresh_token_encrypted AS enc FROM kakao_message_tokens WHERE user_id = ?',
    )
      .bind(userId)
      .first<{ enc: string }>();

    expect(row?.enc).toBeTruthy();
    expect(row?.enc).not.toContain('refresh-code-secret');
  });

  it('카카오가 새 refresh token을 주면 교체 저장하고 다음 갱신에 쓴다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-b', TALK);
    s.kakao.onRefresh = () => ({
      accessToken: 'access-1',
      refreshToken: 'refresh-rotated',
      refreshTokenExpiresInSeconds: 3600,
    });

    await s.identity.getKakaoMessageAccessToken(userId);
    s.kakao.onRefresh = () => ({ accessToken: 'access-2' });
    const second = await s.identity.getKakaoMessageAccessToken(userId);

    expect(second).toBe('access-2');
    expect(s.kakao.refreshCalls).toEqual(['refresh-code-b', 'refresh-rotated']);
  });

  it('교체된 refresh token의 만료 시각도 갱신된다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-c', TALK);
    s.kakao.onRefresh = () => ({
      accessToken: 'access-1',
      refreshToken: 'refresh-short',
      refreshTokenExpiresInSeconds: 3600,
    });
    await s.identity.getKakaoMessageAccessToken(userId);

    s.clock.advanceBy(2 * 60 * 60 * 1000);

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBeNull();
  });

  it('talk_message 동의가 없으면 null이고 카카오를 호출하지 않는다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-d', ['profile_nickname']);

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBeNull();
    expect(s.kakao.refreshCalls).toEqual([]);
  });

  it('다시 로그인해 동의를 철회하면 이후에는 null이다', async () => {
    const s = setup();
    await loginWithScopes(s, 'with-consent', TALK, '5002');
    const userId = await loginWithScopes(s, 'no-consent', ['profile_nickname'], '5002');

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBeNull();
  });

  it('refresh token이 만료되었으면 null이고 카카오를 호출하지 않는다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-e', TALK);

    s.clock.advanceBy(61 * DAY_MS);

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBeNull();
    expect(s.kakao.refreshCalls).toEqual([]);
  });

  it('카카오가 refresh token을 무효로 응답하면 null이다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-f', TALK);
    s.kakao.onRefresh = () => null;

    expect(await s.identity.getKakaoMessageAccessToken(userId)).toBeNull();
  });

  it('토큰이 없는 사용자는 null이다', async () => {
    const { identity } = setup();

    expect(await identity.getKakaoMessageAccessToken('no-such-user')).toBeNull();
  });

  it('카카오 API 오류는 호출한 쪽이 재시도할 수 있게 그대로 던진다', async () => {
    const s = setup();
    const userId = await loginWithScopes(s, 'code-g', TALK);
    s.kakao.onRefresh = () => {
      throw new Error('kakao 503');
    };

    await expect(s.identity.getKakaoMessageAccessToken(userId)).rejects.toThrow('kakao 503');
  });
});

describe('IA 내 계정 조회 [S16][T05]', () => {
  it('로그인한 사용자의 계정 정보를 돌려준다 (알림 수신 기본값은 켜짐)', async () => {
    const s = setup();
    s.kakao.grant('code-me', { kakaoId: '6001', nickname: '민지' });
    const { sessionToken } = await s.identity.loginWithKakao(
      await callbackFor(s.identity, 'code-me'),
    );
    const user = await s.identity.authenticate(sessionToken);

    const me = await s.identity.getMe(user!.userId);

    expect(me).toEqual({
      id: user!.userId,
      nickname: '민지',
      role: 'USER',
      notificationEnabled: true,
      hasRecipient: false,
    });
  });

  it('닉네임이 없는 사용자는 nickname 필드가 없다', async () => {
    const s = setup();
    s.kakao.grant('code-me2', { kakaoId: '6002' });
    const { sessionToken } = await s.identity.loginWithKakao(
      await callbackFor(s.identity, 'code-me2'),
    );
    const user = await s.identity.authenticate(sessionToken);

    const me = await s.identity.getMe(user!.userId);

    expect(me).not.toHaveProperty('nickname');
  });

  it('없는 사용자는 null이다', async () => {
    const { identity } = setup();

    expect(await identity.getMe('no-such-user')).toBeNull();
  });
});
