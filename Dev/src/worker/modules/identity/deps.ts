import type { Clock } from '../../platform/clock';
import type { NotificationMode } from '../../platform/notification-mode';
import type { KakaoOAuthClient } from '../../ports/kakao-oauth';
import type { RecipientResolver } from '../../ports/recipient-resolver';

export interface IdentityDeps {
  db: D1Database;
  clock: Clock;
  kakao: KakaoOAuthClient;
  /** 알림 발송 어댑터 선택값(`NOTIFICATION_MODE`). `Me.hasRecipient` 판정 기준을 정한다 */
  notificationMode: NotificationMode;
  /** 발송 시점의 수신처 조회 (`getNotificationRecipient`) */
  recipientResolver: RecipientResolver;
  /** state 서명용 HMAC 키 (`SESSION_SIGNING_KEY`) */
  sessionSigningKey: string;
  /** 카카오 refresh token 암호화 키: base64로 표현한 AES-256 키 (`KAKAO_TOKEN_ENCRYPTION_KEY`) */
  tokenEncryptionKey: string;
}
