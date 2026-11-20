import type { Logger } from '../http/logger';
import type { NotificationMode } from '../platform/notification-mode';
import type { NotificationSender } from '../ports/notification-sender';
import { LogNotificationSender } from './notification-log';

/**
 * `NOTIFICATION_MODE`에 맞는 발송 어댑터. 아직 구현되지 않은 모드(`kakao_memo`는 T34, `dealer`는 T31)는
 * `undefined`다. 그 동안 디스패처는 슬롯을 선점하지 않는다.
 */
export function createNotificationSender(
  mode: NotificationMode,
  logger: Pick<Logger, 'info'>,
): NotificationSender | undefined {
  switch (mode) {
    case 'log':
      return new LogNotificationSender(logger);
    case 'kakao_memo':
    case 'dealer':
      return undefined;
  }
}
