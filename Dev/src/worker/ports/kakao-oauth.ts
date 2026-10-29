export interface KakaoTokenSet {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresInSeconds: number;
  scopes: string[];
}

export interface KakaoProfile {
  kakaoId: string;
  nickname?: string;
}

export interface KakaoRefreshResult {
  accessToken: string;
  /** 카카오는 refresh token 만료가 가까울 때만 새 값을 준다 */
  refreshToken?: string;
  refreshTokenExpiresInSeconds?: number;
}

export interface KakaoOAuthClient {
  buildAuthorizeUrl(params: { state: string; redirectUri: string }): string;
  /** `null`이면 인가 코드가 만료되었거나 올바르지 않다. 그 밖의 API 오류는 throw한다 */
  exchangeCode(params: { code: string; redirectUri: string }): Promise<KakaoTokenSet | null>;
  fetchProfile(accessToken: string): Promise<KakaoProfile>;
  /** `null`이면 refresh token이 만료·무효라 재동의가 필요하다. 그 밖의 API 오류는 throw한다 */
  refreshAccessToken(refreshToken: string): Promise<KakaoRefreshResult | null>;
}
