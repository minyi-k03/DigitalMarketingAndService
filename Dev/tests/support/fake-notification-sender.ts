import type {
  NotificationSender,
  OutgoingNotification,
} from '../../src/worker/ports/notification-sender';
import type { Recipient } from '../../src/worker/ports/recipient-resolver';

export interface SentCall {
  recipient: Recipient;
  notification: OutgoingNotification;
}

/** 발송 대신 쓰는 테스트 더블. 호출을 기록하고 `failNext`로 실패를 만든다 */
export class FakeNotificationSender implements NotificationSender {
  calls: SentCall[] = [];
  /** 남은 횟수만큼 던진다. 기본은 모두 성공 */
  private failures = 0;
  /** 발송 도중(다른 호출이 겹치는 순간)에 끼어들 때 쓰는 훅. 인자는 이 호출의 0부터 센 순번이다 */
  onSend: ((callIndex: number) => Promise<void>) | undefined;

  failNext(times: number): void {
    this.failures = times;
  }

  async send(input: SentCall): Promise<void> {
    this.calls.push(input);
    if (this.onSend) await this.onSend(this.calls.length - 1);
    if (this.failures > 0) {
      this.failures -= 1;
      throw new Error('발송 실패(테스트)');
    }
  }
}
