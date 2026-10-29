import type { Clock } from '../../platform/clock';
import type { KakaoOAuthClient } from '../../ports/kakao-oauth';

export interface IdentityDeps {
  db: D1Database;
  clock: Clock;
  kakao: KakaoOAuthClient;
  /** state 서명용 HMAC 키 (`SESSION_SIGNING_KEY`) */
  sessionSigningKey: string;
  /** 카카오 refresh token 암호화 키: base64로 표현한 AES-256 키 (`KAKAO_TOKEN_ENCRYPTION_KEY`) */
  tokenEncryptionKey: string;
}
