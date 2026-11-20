import { describe, expect, it } from 'vitest';
import { LogNotificationSender } from '../../src/worker/adapters/notification-log';
import type { OutgoingNotification } from '../../src/worker/ports/notification-sender';

const notification: OutgoingNotification = {
  kind: 'ESCAPE_ALERT',
  slot: 'D3',
  variant: 'REGULAR',
  templateKey: 'ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END',
  catalogItemName: '시연용 OTT',
  link: '/bridge/trial-1',
};

function build() {
  const logs: { event: string; fields: Record<string, unknown> | undefined }[] = [];
  const sender = new LogNotificationSender({
    info: (event, fields) => logs.push({ event, fields }),
  });
  return { sender, logs };
}

describe('log 알림 어댑터 [S13][V-10][T17]', () => {
  it('종류·슬롯·템플릿 키·링크만 기록한다', async () => {
    const { sender, logs } = build();

    await sender.send({
      recipient: { channel: 'KAKAO_MEMO', accessToken: 'secret-access-token' },
      notification,
    });

    expect(logs).toEqual([
      {
        event: 'notification_logged',
        fields: {
          kind: 'ESCAPE_ALERT',
          slot: 'D3',
          templateKey: 'ESCAPE_ALERT.REGULAR.RETAIN_UNTIL_END',
          link: '/bridge/trial-1',
        },
      },
    ]);
  });

  it('수신처의 토큰·전화번호는 어떤 필드에도 남기지 않는다 (AGENTS §6)', async () => {
    const { sender, logs } = build();

    await sender.send({
      recipient: { channel: 'KAKAO_MEMO', accessToken: 'secret-access-token' },
      notification,
    });
    await sender.send({
      recipient: { channel: 'ALIMTALK', phoneNumber: '01012345678' },
      notification,
    });

    const written = JSON.stringify(logs);
    expect(written).not.toContain('secret-access-token');
    expect(written).not.toContain('01012345678');
  });
});
