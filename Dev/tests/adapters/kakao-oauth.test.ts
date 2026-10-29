import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpKakaoOAuthClient } from '../../src/worker/adapters/kakao-oauth';

interface Captured {
  url: string;
  method: string;
  authorization: string | null;
  contentType: string | null;
  form: URLSearchParams;
}

/** fetch를 모의한다 (V-10: 외부 HTTP 어댑터 단위 테스트만 허용되는 예외) */
function mockFetch(respond: (req: Captured) => Response | Promise<Response>) {
  const calls: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req: Captured = {
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: new Headers(init?.headers).get('Authorization'),
      contentType: new Headers(init?.headers).get('Content-Type'),
      form: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''),
    };
    calls.push(req);
    return respond(req);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const REDIRECT_URI = 'https://subcut.test/auth/kakao/callback';

function client(fetchImpl: typeof fetch) {
  return new HttpKakaoOAuthClient({
    clientId: 'rest-api-key',
    clientSecret: 'super-secret',
    fetch: fetchImpl,
  });
}

describe('카카오 OAuth 어댑터 [D-16][V-10][T05]', () => {
  afterEach(() => vi.unstubAllGlobals());

  // Workers의 전역 fetch는 this가 전역이 아닌 상태로 호출하면 "Illegal invocation"이 난다
  it('fetch를 주입하지 않으면 전역 fetch를 this 없이 호출한다', async () => {
    const receivers: unknown[] = [];
    vi.stubGlobal('fetch', function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(json({ id: 1 }));
    });

    await new HttpKakaoOAuthClient({ clientId: 'id', clientSecret: 'secret' }).fetchProfile('a');

    expect(receivers).toHaveLength(1);
    expect(receivers[0]).toBeOneOf([undefined, globalThis]);
  });

  it('인가 URL에 client_id·redirect_uri·state와 쉼표로 구분한 scope를 담는다', () => {
    const { fetchImpl } = mockFetch(() => json({}));

    const url = new URL(
      client(fetchImpl).buildAuthorizeUrl({ state: 's.t', redirectUri: REDIRECT_URI }),
    );

    expect(`${url.origin}${url.pathname}`).toBe('https://kauth.kakao.com/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('rest-api-key');
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('state')).toBe('s.t');
    expect(url.searchParams.get('scope')).toBe('profile_nickname,talk_message');
  });

  describe('exchangeCode', () => {
    it('인가 코드를 form 본문으로 보내고 토큰 응답을 변환한다', async () => {
      const { fetchImpl, calls } = mockFetch(() =>
        json({
          token_type: 'bearer',
          access_token: 'access-1',
          expires_in: 21599,
          refresh_token: 'refresh-1',
          refresh_token_expires_in: 5183999,
          scope: 'profile_nickname talk_message',
        }),
      );

      const tokens = await client(fetchImpl).exchangeCode({
        code: 'auth-code',
        redirectUri: REDIRECT_URI,
      });

      expect(tokens).toEqual({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        refreshTokenExpiresInSeconds: 5183999,
        scopes: ['profile_nickname', 'talk_message'],
      });
      expect(calls).toHaveLength(1);
      expect(calls[0]).toMatchObject({
        url: 'https://kauth.kakao.com/oauth/token',
        method: 'POST',
        contentType: expect.stringContaining('application/x-www-form-urlencoded'),
      });
      expect(Object.fromEntries(calls[0]!.form)).toEqual({
        grant_type: 'authorization_code',
        client_id: 'rest-api-key',
        client_secret: 'super-secret',
        redirect_uri: REDIRECT_URI,
        code: 'auth-code',
      });
    });

    it('scope가 없으면 빈 배열이다', async () => {
      const { fetchImpl } = mockFetch(() =>
        json({ access_token: 'a', refresh_token: 'r', expires_in: 1, refresh_token_expires_in: 1 }),
      );

      const tokens = await client(fetchImpl).exchangeCode({ code: 'c', redirectUri: REDIRECT_URI });

      expect(tokens?.scopes).toEqual([]);
    });

    it('인가 코드가 무효(invalid_grant)이면 null이다', async () => {
      const { fetchImpl } = mockFetch(() =>
        json({ error: 'invalid_grant', error_description: 'bad code', error_code: 'KOE320' }, 400),
      );

      expect(
        await client(fetchImpl).exchangeCode({ code: 'x', redirectUri: REDIRECT_URI }),
      ).toBeNull();
    });

    it('그 밖의 API 오류는 던지고 비밀값을 메시지에 담지 않는다', async () => {
      const { fetchImpl } = mockFetch(() => new Response('upstream down', { status: 503 }));

      const error = await client(fetchImpl)
        .exchangeCode({ code: 'secret-auth-code', redirectUri: REDIRECT_URI })
        .then(
          () => null,
          (e: unknown) => e as Error,
        );

      expect(error).toBeInstanceOf(Error);
      expect(error?.message).toContain('503');
      expect(error?.message).not.toContain('super-secret');
      expect(error?.message).not.toContain('secret-auth-code');
    });
  });

  describe('fetchProfile', () => {
    it('Bearer 토큰으로 조회해 회원번호와 닉네임을 돌려준다', async () => {
      const { fetchImpl, calls } = mockFetch(() =>
        json({ id: 1234567890, kakao_account: { profile: { nickname: '민지' } } }),
      );

      const profile = await client(fetchImpl).fetchProfile('access-1');

      expect(profile).toEqual({ kakaoId: '1234567890', nickname: '민지' });
      expect(calls[0]).toMatchObject({
        url: 'https://kapi.kakao.com/v2/user/me',
        authorization: 'Bearer access-1',
      });
    });

    it('닉네임 동의가 없으면 nickname이 없다', async () => {
      const { fetchImpl } = mockFetch(() => json({ id: 42, kakao_account: {} }));

      expect(await client(fetchImpl).fetchProfile('a')).toEqual({ kakaoId: '42' });
    });

    it('API 오류는 던진다', async () => {
      const { fetchImpl } = mockFetch(() => json({ msg: 'invalid token', code: -401 }, 401));

      await expect(client(fetchImpl).fetchProfile('bad')).rejects.toThrow('401');
    });
  });

  describe('refreshAccessToken', () => {
    it('refresh_token grant로 요청하고 새 refresh token이 없으면 access token만 돌려준다', async () => {
      const { fetchImpl, calls } = mockFetch(() =>
        json({ token_type: 'bearer', access_token: 'access-2', expires_in: 21599 }),
      );

      const result = await client(fetchImpl).refreshAccessToken('refresh-1');

      expect(result).toEqual({ accessToken: 'access-2' });
      expect(Object.fromEntries(calls[0]!.form)).toEqual({
        grant_type: 'refresh_token',
        client_id: 'rest-api-key',
        client_secret: 'super-secret',
        refresh_token: 'refresh-1',
      });
    });

    it('새 refresh token과 만료 초가 오면 함께 돌려준다', async () => {
      const { fetchImpl } = mockFetch(() =>
        json({
          access_token: 'access-3',
          expires_in: 21599,
          refresh_token: 'refresh-2',
          refresh_token_expires_in: 5183999,
        }),
      );

      expect(await client(fetchImpl).refreshAccessToken('refresh-1')).toEqual({
        accessToken: 'access-3',
        refreshToken: 'refresh-2',
        refreshTokenExpiresInSeconds: 5183999,
      });
    });

    it('refresh token이 무효(invalid_grant)이면 null이다', async () => {
      const { fetchImpl } = mockFetch(() =>
        json({ error: 'invalid_grant', error_code: 'KOE322' }, 400),
      );

      expect(await client(fetchImpl).refreshAccessToken('expired')).toBeNull();
    });

    it('서버 오류와 네트워크 오류는 던진다 (재시도 대상)', async () => {
      const serverError = mockFetch(() => new Response('oops', { status: 500 }));
      await expect(client(serverError.fetchImpl).refreshAccessToken('r')).rejects.toThrow('500');

      const network = mockFetch(() => {
        throw new TypeError('network down');
      });
      await expect(client(network.fetchImpl).refreshAccessToken('r')).rejects.toThrow(
        'network down',
      );
    });
  });
});
