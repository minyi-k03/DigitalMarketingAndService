import { describe, expect, it } from 'vitest';
import { KakaoMemoNotificationSender } from '../../src/worker/adapters/kakao-memo';
import { LogNotificationSender } from '../../src/worker/adapters/notification-log';
import { createNotificationSender } from '../../src/worker/adapters/select-sender';

const logger = { info: () => {} };

describe('발송 어댑터 선택 (NOTIFICATION_MODE) [T17][T34]', () => {
  it('log 모드는 log 어댑터를 쓴다', () => {
    expect(createNotificationSender('log', logger)).toBeInstanceOf(LogNotificationSender);
  });

  it('kakao_memo 모드는 앱 주소가 있으면 kakao-memo 어댑터를 쓴다 (D-16)', () => {
    const sender = createNotificationSender('kakao_memo', logger, {
      appEnv: 'production',
      appOrigin: 'https://subcut.test',
    });

    expect(sender).toBeInstanceOf(KakaoMemoNotificationSender);
  });

  it('staging에서는 kakao_memo를 막는다: 실제 카카오 메시지가 나가지 않는다 (AGENTS §6)', () => {
    expect(
      createNotificationSender('kakao_memo', logger, {
        appEnv: 'staging',
        appOrigin: 'https://subcut.test',
      }),
    ).toBeUndefined();
  });

  it('staging에서도 log 모드는 쓴다', () => {
    expect(
      createNotificationSender('log', logger, {
        appEnv: 'staging',
        appOrigin: 'https://subcut.test',
      }),
    ).toBeInstanceOf(LogNotificationSender);
  });

  it('앱 주소가 없거나 유효한 origin이 아니면 kakao_memo 어댑터를 만들지 않는다: 링크를 만들 수 없다', () => {
    const invalid = [
      undefined,
      '',
      '/',
      '   ',
      'subcut.workers.dev',
      'http://subcut.test',
      'ftp://x.test',
    ];
    for (const appOrigin of invalid) {
      expect(
        createNotificationSender('kakao_memo', logger, { appEnv: 'production', appOrigin }),
        String(appOrigin),
      ).toBeUndefined();
    }
  });

  it('끝 슬래시와 경로가 붙은 주소는 origin으로 보정하고, 로컬 개발의 http://localhost는 허용한다', () => {
    for (const appOrigin of [
      'https://subcut.test/',
      'https://subcut.test/path',
      'http://localhost:8787',
    ]) {
      expect(
        createNotificationSender('kakao_memo', logger, { appEnv: 'dev', appOrigin }),
        appOrigin,
      ).toBeInstanceOf(KakaoMemoNotificationSender);
    }
  });

  it('dealer는 어댑터가 생기기 전(T31)까지 없다', () => {
    expect(createNotificationSender('dealer', logger)).toBeUndefined();
  });
});
