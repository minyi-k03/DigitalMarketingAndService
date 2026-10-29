import type {
  KakaoOAuthClient,
  KakaoProfile,
  KakaoRefreshResult,
  KakaoTokenSet,
} from '../ports/kakao-oauth';

const AUTHORIZE_URL = 'https://kauth.kakao.com/oauth/authorize';
const TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const PROFILE_URL = 'https://kapi.kakao.com/v2/user/me';

// 동의항목 ID는 쉼표로 구분한다 (카카오 로그인 REST API 문서)
const SCOPE = 'profile_nickname,talk_message';

interface Options {
  clientId: string;
  clientSecret: string;
  fetch?: typeof fetch;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

/**
 * 카카오 로그인 REST API 어댑터 (D-16).
 * 인가 코드·refresh token이 무효일 때의 오류 응답을 HTTP 400 + `error: "invalid_grant"`로 가정했다.
 * 공식 문서에는 토큰 엔드포인트의 오류 본문이 명시되어 있지 않으므로 N8 이후 실제 응답으로 확인한다.
 */
export class HttpKakaoOAuthClient implements KakaoOAuthClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ clientId, clientSecret, fetch: fetchImpl }: Options) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    // 전역 fetch를 필드에 담아 this.fetchImpl()로 부르면 Workers에서 "Illegal invocation"이 난다
    this.fetchImpl = fetchImpl ?? ((input, init) => fetch(input, init));
  }

  buildAuthorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set('client_id', this.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', SCOPE);
    return url.toString();
  }

  async exchangeCode({
    code,
    redirectUri,
  }: {
    code: string;
    redirectUri: string;
  }): Promise<KakaoTokenSet | null> {
    const res = await this.postToken({
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    });
    if (await isInvalidGrant(res)) return null;
    const body = await readJson<TokenResponse>(res, '토큰 발급');
    return {
      accessToken: body.access_token,
      refreshToken: required(body.refresh_token, 'refresh_token'),
      refreshTokenExpiresInSeconds: required(
        body.refresh_token_expires_in,
        'refresh_token_expires_in',
      ),
      scopes: (body.scope ?? '').split(' ').filter(Boolean),
    };
  }

  async fetchProfile(accessToken: string): Promise<KakaoProfile> {
    const res = await this.fetchImpl(PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await readJson<{
      id: number | string;
      kakao_account?: { profile?: { nickname?: string } };
    }>(res, '사용자 정보 조회');
    const nickname = body.kakao_account?.profile?.nickname;
    return { kakaoId: String(body.id), ...(nickname && { nickname }) };
  }

  async refreshAccessToken(refreshToken: string): Promise<KakaoRefreshResult | null> {
    const res = await this.postToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
    if (await isInvalidGrant(res)) return null;
    const body = await readJson<TokenResponse>(res, '토큰 갱신');
    return {
      accessToken: body.access_token,
      ...(body.refresh_token && { refreshToken: body.refresh_token }),
      ...(body.refresh_token_expires_in && {
        refreshTokenExpiresInSeconds: body.refresh_token_expires_in,
      }),
    };
  }

  private postToken(params: Record<string, string>): Promise<Response> {
    return this.fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({
        ...params,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });
  }
}

async function isInvalidGrant(res: Response): Promise<boolean> {
  if (res.status !== 400) return false;
  const body = (await res
    .clone()
    .json()
    .catch(() => null)) as { error?: string } | null;
  return body?.error === 'invalid_grant';
}

/** 오류 메시지에는 상태 코드만 담는다. 요청·응답 본문에 비밀값이 있을 수 있다 */
async function readJson<T>(res: Response, operation: string): Promise<T> {
  if (!res.ok) throw new Error(`카카오 ${operation} 실패: HTTP ${res.status}`);
  return (await res.json()) as T;
}

function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`카카오 토큰 응답에 ${name}이 없습니다`);
  return value;
}
