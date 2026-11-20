import type { Logger } from '../http/logger';
import type { NotificationSender, OutgoingNotification } from '../ports/notification-sender';
import type { Recipient } from '../ports/recipient-resolver';

/**
 * `NOTIFICATION_MODE=log` 어댑터. 실제로 보내지 않고 무엇을 보냈을지만 남긴다. staging과 개발 환경은
 * 이 모드만 쓴다 (AGENTS §6). 수신처(토큰·전화번호)는 어떤 필드에도 남기지 않는다.
 */
export class LogNotificationSender implements NotificationSender {
  constructor(private readonly logger: Pick<Logger, 'info'>) {}

  async send({
    notification,
  }: {
    recipient: Recipient;
    notification: OutgoingNotification;
  }): Promise<void> {
    this.logger.info('notification_logged', {
      kind: notification.kind,
      slot: notification.slot,
      templateKey: notification.templateKey,
      link: notification.link,
    });
  }
}
