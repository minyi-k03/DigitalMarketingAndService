import type { Logger } from '../http/logger';
import type { NotificationMode } from '../platform/notification-mode';
import type { NotificationSender } from '../ports/notification-sender';
import { KakaoMemoNotificationSender, parseAppOrigin } from './kakao-memo';
import { LogNotificationSender } from './notification-log';

export interface SenderOptions {
  /** 배포 환경 (`dev` | `staging` | `production`). staging은 `log`만 허용한다 (AGENTS §6) */
  appEnv?: string;
  /** 알림 링크의 도메인(`https://…`, 로컬은 `http://localhost`). `kakao_memo`에 필요하다 */
  appOrigin?: string;
}

/**
 * `NOTIFICATION_MODE`에 맞는 발송 어댑터. 만들 수 없는 경우(`dealer`는 T31 전, staging의 `kakao_memo`,
 * 앱 주소가 없거나 올바른 origin이 아닌 `kakao_memo`)는 `undefined`이고 그 동안 디스패처는 슬롯을 선점하지 않는다.
 * 요청마다 던지지 않고 `undefined`로 막는 것은 설정 오류가 전체 API를 멈추지 않게 하기 위해서다.
 */
export function createNotificationSender(
  mode: NotificationMode,
  logger: Pick<Logger, 'info'>,
  { appEnv, appOrigin }: SenderOptions = {},
): NotificationSender | undefined {
  switch (mode) {
    case 'log':
      return new LogNotificationSender(logger);
    case 'kakao_memo':
      if (appEnv === 'staging') return undefined;
      return createKakaoMemoSender(appOrigin);
    case 'dealer':
      return undefined;
  }
}

function createKakaoMemoSender(appOrigin: string | undefined): NotificationSender | undefined {
  const origin = appOrigin === undefined ? null : parseAppOrigin(appOrigin);
  return origin === null ? undefined : new KakaoMemoNotificationSender({ appOrigin: origin });
}
