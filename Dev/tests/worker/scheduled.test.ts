import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { LogNotificationSender } from '../../src/worker/adapters/notification-log';
import { createNotificationSender } from '../../src/worker/adapters/select-sender';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { DISPATCH_CRON, MISSED_BILLED_CRON, runScheduled } from '../../src/worker/scheduled';
import { slotStatusesOf } from '../support/trial-state-seed';
import { buildIdentity } from '../support/identity';
import { registerTrial } from '../support/trial-tracking';

const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const D3_AT = '2026-12-01T01:00:00.000Z';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM notification_schedules').run();
});

type LogEntry = { level: 'info' | 'error'; event: string; fields?: Record<string, unknown> };

function collectLogs() {
  const logs: LogEntry[] = [];
  return {
    logs,
    logger: {
      info: (event: string, fields?: Record<string, unknown>) =>
        logs.push({ level: 'info', event, fields }),
      error: (event: string, fields?: Record<string, unknown>) =>
        logs.push({ level: 'error', event, fields }),
    },
  };
}

async function dueTrial() {
  const t = await registerTrial(NOON_KST_NOV_5);
  t.recipients.set(t.userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
  t.clock.set(D3_AT);
  return t;
}

describe('scheduled 핸들러 [S13][T17]', () => {
  it('10분 주기 Cron은 도래한 알림을 발송하고 처리 건수를 기록한다', async () => {
    const t = await dueTrial();
    const { logs, logger } = collectLogs();

    await runScheduled(DISPATCH_CRON, { trialTracking: t.trialTracking, logger, canSend: true });

    expect(t.sender.calls.map((c) => c.notification.slot)).toEqual(['D3']);
    expect(logs).toEqual([
      {
        level: 'info',
        event: 'notification_dispatch',
        fields: { reclaimed: 0, expired: 0, sent: 1, skipped: 0, retried: 0, failed: 0 },
      },
    ]);
  });

  it('MISSED_BILLED 배치 Cron은 T18 전까지 알림을 발송하지 않는다', async () => {
    const t = await dueTrial();
    const { logs, logger } = collectLogs();

    await runScheduled(MISSED_BILLED_CRON, {
      trialTracking: t.trialTracking,
      logger,
      canSend: true,
    });

    expect(t.sender.calls).toEqual([]);
    expect(logs).toEqual([]);
  });

  it('발송 어댑터가 없으면 슬롯을 선점하지 않고 오류를 기록한다 (알림이 FAILED로 소진되지 않게)', async () => {
    const t = await dueTrial();
    const { logs, logger } = collectLogs();

    await runScheduled(DISPATCH_CRON, { trialTracking: t.trialTracking, logger, canSend: false });

    expect(t.sender.calls).toEqual([]);
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'PENDING' },
    ]);
    expect(logs).toEqual([
      { level: 'error', event: 'notification_sender_unavailable', fields: undefined },
    ]);
  });

  it('발송 중 예기치 않은 오류는 던지지 않고 종류만 기록한다 (다음 회차가 이어받는다)', async () => {
    const { logs, logger } = collectLogs();

    await runScheduled(DISPATCH_CRON, {
      trialTracking: {
        dispatchDueNotifications: async () => {
          throw new TypeError('토큰 abc 포함 메시지');
        },
      },
      logger,
      canSend: true,
    });

    expect(logs).toEqual([
      { level: 'error', event: 'notification_dispatch_failed', fields: { name: 'TypeError' } },
    ]);
  });
});

describe('발송 어댑터 선택 (NOTIFICATION_MODE) [T17]', () => {
  it('log 모드는 log 어댑터를 쓴다', () => {
    expect(createNotificationSender('log', { info: () => {} })).toBeInstanceOf(
      LogNotificationSender,
    );
  });

  it('kakao_memo·dealer는 어댑터가 생기기 전(T34·T31)까지 없다', () => {
    expect(createNotificationSender('kakao_memo', { info: () => {} })).toBeUndefined();
    expect(createNotificationSender('dealer', { info: () => {} })).toBeUndefined();
  });
});

describe('발송 어댑터가 없는 TT 서비스 [T17]', () => {
  it('어댑터가 없으면 디스패치는 아무 슬롯도 선점하거나 닫지 않는다', async () => {
    const t = await dueTrial();
    const { identity } = buildIdentity(t.clock);
    const withoutSender = createTrialTrackingService({
      db: env.DB,
      clock: t.clock,
      catalog: t.catalog,
      identity,
      sender: undefined,
    });

    const result = await withoutSender.dispatchDueNotifications({ trialRecordId: t.record.id });

    expect(result).toEqual({
      reclaimed: 0,
      expired: 0,
      sent: 0,
      skipped: 0,
      retried: 0,
      failed: 0,
    });
    expect(await slotStatusesOf(t.record.id)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'PENDING' },
    ]);
  });
});
