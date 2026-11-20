import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { DISPATCH_CRON, MISSED_BILLED_CRON, runScheduled } from '../../src/worker/scheduled';
import { slotStatusesOf } from '../support/trial-state-seed';
import { buildIdentity } from '../support/identity';
import { registerTrial } from '../support/trial-tracking';

const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const D3_AT = '2026-12-01T01:00:00.000Z';
const BATCH_AT = '2026-12-05T15:10:00.000Z'; // billingDate 다음 날 00:10 KST

// 배치는 모든 기록을 대상으로 하므로 앞선 테스트의 기록이 처리 건수에 섞이지 않게 기록째 비운다
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM trial_records').run();
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
        runMissedBilledBatch: async () => ({ transitioned: 0, scheduled: 0 }),
      },
      logger,
      canSend: true,
    });

    expect(logs).toEqual([
      { level: 'error', event: 'notification_dispatch_failed', fields: { name: 'TypeError' } },
    ]);
  });
});

describe('scheduled 핸들러 MISSED_BILLED 배치 [S31][S-03][T18]', () => {
  it('MISSED_BILLED 배치 Cron은 전이와 알림 예약을 하고 처리 건수를 기록하며 알림은 보내지 않는다 [S31][T18]', async () => {
    const t = await dueTrial();
    t.clock.set(BATCH_AT);
    const { logs, logger } = collectLogs();

    await runScheduled(MISSED_BILLED_CRON, {
      trialTracking: t.trialTracking,
      logger,
      canSend: true,
    });

    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({ status: 'MISSED_BILLED' });
    expect(t.sender.calls).toEqual([]);
    expect(logs).toEqual([
      {
        level: 'info',
        event: 'missed_billed_batch',
        fields: { transitioned: 1, scheduled: 1 },
      },
    ]);
  });

  it('MISSED_BILLED 배치는 발송 어댑터가 없어도 돈다 (전이·예약은 발송과 무관하다)', async () => {
    const t = await dueTrial();
    t.clock.set(BATCH_AT);
    const { logs, logger } = collectLogs();

    await runScheduled(MISSED_BILLED_CRON, {
      trialTracking: t.trialTracking,
      logger,
      canSend: false,
    });

    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({ status: 'MISSED_BILLED' });
    expect(logs.map((l) => l.event)).toEqual(['missed_billed_batch']);
  });

  it('MISSED_BILLED 배치 중 예기치 않은 오류는 던지지 않고 종류만 기록한다', async () => {
    const { logs, logger } = collectLogs();

    await runScheduled(MISSED_BILLED_CRON, {
      trialTracking: {
        dispatchDueNotifications: async () => ({
          reclaimed: 0,
          expired: 0,
          sent: 0,
          skipped: 0,
          retried: 0,
          failed: 0,
        }),
        runMissedBilledBatch: async () => {
          throw new TypeError('설정 값 abc 포함 메시지');
        },
      },
      logger,
      canSend: true,
    });

    expect(logs).toEqual([
      { level: 'error', event: 'missed_billed_batch_failed', fields: { name: 'TypeError' } },
    ]);
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
