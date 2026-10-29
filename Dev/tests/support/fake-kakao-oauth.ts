import type {
  KakaoOAuthClient,
  KakaoProfile,
  KakaoRefreshResult,
  KakaoTokenSet,
} from '../../src/worker/ports/kakao-oauth';

interface Grant {
  profile: KakaoProfile;
  scopes: string[];
}

/** 카카오 서버 대신 쓰는 테스트 더블. `grant`로 인가 코드를 미리 발급해 둔다 */
export class FakeKakaoOAuthClient implements KakaoOAuthClient {
  private grants = new Map<string, Grant>();
  private profiles = new Map<string, KakaoProfile>();
  refreshCalls: string[] = [];
  /** 기본 동작: 항상 새 access token만 준다. 테스트에서 덮어쓴다 */
  onRefresh: (refreshToken: string) => KakaoRefreshResult | null = (refreshToken) => ({
    accessToken: `access-from-${refreshToken}`,
  });

  grant(code: string, profile: KakaoProfile, scopes: string[] = ['profile_nickname']): void {
    this.grants.set(code, { profile, scopes });
  }

  buildAuthorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const url = new URL('https://kakao.test/oauth/authorize');
    url.searchParams.set('state', state);
    url.searchParams.set('redirect_uri', redirectUri);
    return url.toString();
  }

  async exchangeCode({
    code,
  }: {
    code: string;
    redirectUri: string;
  }): Promise<KakaoTokenSet | null> {
    const grant = this.grants.get(code);
    if (!grant) return null;
    const accessToken = `access-${code}`;
    this.profiles.set(accessToken, grant.profile);
    return {
      accessToken,
      refreshToken: `refresh-${code}`,
      refreshTokenExpiresInSeconds: 60 * 24 * 60 * 60,
      scopes: grant.scopes,
    };
  }

  async fetchProfile(accessToken: string): Promise<KakaoProfile> {
    const profile = this.profiles.get(accessToken);
    if (!profile) throw new Error(`알 수 없는 access token: ${accessToken}`);
    return profile;
  }

  async refreshAccessToken(refreshToken: string): Promise<KakaoRefreshResult | null> {
    this.refreshCalls.push(refreshToken);
    return this.onRefresh(refreshToken);
  }
}
