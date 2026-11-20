import type { Clock } from '../../platform/clock';
import type { NotificationSender } from '../../ports/notification-sender';
import type { CatalogService } from '../catalog';
import type { IdentityService } from '../identity';

export interface TrialTrackingDeps {
  db: D1Database;
  clock: Clock;
  /** 카탈로그는 공개 조회로만 읽는다 (architecture §3) */
  catalog: Pick<CatalogService, 'getTrackingTerms' | 'getEscapeContent'>;
  /** 발송 시점의 수신 여부·수신처는 Identity의 공개 조회로만 얻는다 (architecture §3.2) */
  identity: Pick<IdentityService, 'getNotificationRecipient'>;
  /** `NOTIFICATION_MODE`로 고른 발송 어댑터. 아직 구현되지 않은 모드면 `undefined`이고 디스패처는 슬롯을 선점하지 않는다 */
  sender: NotificationSender | undefined;
}
