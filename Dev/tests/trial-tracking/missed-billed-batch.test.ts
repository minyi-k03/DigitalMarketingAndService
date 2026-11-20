import { env } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  exitPollResponsesOf,
  forceMissedBilled,
  markSlot,
  setSendTimeSetting,
  slotsOf,
} from '../support/trial-state-seed';
import { statesAllowing } from '../../src/worker/modules/trial-tracking/domain/transitions';
import { registerTrial } from '../support/trial-tracking';

// 2026-11-05 12:00 KST에 기본 항목(글로벌, 30일)을 오늘 등록하면 billingDate 2026-12-05, safeEndDate 2026-12-04,
// D3 = 12-01 10:00 KST, D1 = 12-03 10:00 KST. 배치는 billingDate 다음 날 00:10 KST에 돈다.
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const BATCH_AT = '2026-12-05T15:10:00.000Z'; // 12-06 00:10 KST (UTC 날짜는 아직 12-05)
const JUST_BEFORE_MIDNIGHT_KST = '2026-12-05T14:59:59.000Z'; // 12-05 23:59:59 KST = billingDate 당일
const BILLING_CHECK_AT = '2026-12-06T01:00:00.000Z'; // 12-06 10:00 KST

// 배치는 모든 기록을 대상으로 하므로 같은 파일의 앞선 테스트가 만든 기록이 섞이지 않게 비운다
// (알림·ExitPoll 응답은 기록 삭제에 함께 지워진다)
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM trial_records').run();
});

afterEach(() => setSendTimeSetting('"10:00"'));

async function register() {
  const t = await registerTrial(NOON_KST_NOV_5);
  t.recipients.set(t.userId, { channel: 'KAKAO_MEMO', accessToken: 'access-token' });
  return t;
}

describe('TT MISSED_BILLED 배치 [S31][S-03][T18]', () => {
  it('BillingDate가 지난 TRACKING 기록을 MISSED_BILLED로 바꾸고 남은 알림을 취소한 뒤 BILLING_CHECK를 예약한다', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);

    const result = await t.trialTracking.runMissedBilledBatch();

    expect(result).toEqual({ transitioned: 1, scheduled: 1 });
    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({
      status: 'MISSED_BILLED',
      statusChangedAt: BATCH_AT,
    });
    expect(await slotsOf(t.record.id)).toEqual([
      expect.objectContaining({ slot: 'D3', status: 'CANCELED' }),
      expect.objectContaining({ slot: 'D1', status: 'CANCELED' }),
      {
        kind: 'BILLING_CHECK',
        slot: 'BILLING_CHECK',
        variant: 'REGULAR',
        safeEndDate: '2026-12-04',
        sendAt: BILLING_CHECK_AT,
        status: 'PENDING',
      },
    ]);
  });

  it('CANCEL_ATTEMPTED 기록도 전이하고 기존 ExitPoll 응답을 보존한다', async () => {
    const t = await register();
    await t.trialTracking.startCancelAttempt({ ...t.ref, exitReason: 'PRICE_BURDEN' });
    t.clock.set(BATCH_AT);

    const result = await t.trialTracking.runMissedBilledBatch();

    expect(result).toEqual({ transitioned: 1, scheduled: 1 });
    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({
      status: 'MISSED_BILLED',
      exitReason: 'PRICE_BURDEN',
    });
    expect(await exitPollResponsesOf(t.record.id)).toMatchObject([{ reason: 'PRICE_BURDEN' }]);
    expect(await slotsOf(t.record.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slot: 'D1_CONFIRM', status: 'CANCELED' }),
        expect.objectContaining({ slot: 'BILLING_CHECK', status: 'PENDING' }),
      ]),
    );
  });

  it('두 번 실행해도 전이와 알림은 한 번이다 (두 번째는 아무것도 바꾸지 않는다)', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);
    await t.trialTracking.runMissedBilledBatch();
    const afterFirst = await slotsOf(t.record.id);
    t.clock.advanceBy(60_000);

    const second = await t.trialTracking.runMissedBilledBatch();

    expect(second).toEqual({ transitioned: 0, scheduled: 0 });
    expect(await slotsOf(t.record.id)).toEqual(afterFirst);
    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({
      status: 'MISSED_BILLED',
      statusChangedAt: BATCH_AT, // 두 번째 실행이 전이 시각을 덮지 않는다
    });
  });

  it('겹쳐 실행해도(동시) 전이와 BILLING_CHECK는 한 번이다', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);

    const results = await Promise.all([
      t.trialTracking.runMissedBilledBatch(),
      t.trialTracking.runMissedBilledBatch(),
    ]);

    expect(results.reduce((sum, r) => sum + r.transitioned, 0)).toBe(1);
    expect((await slotsOf(t.record.id)).filter((s) => s.slot === 'BILLING_CHECK')).toHaveLength(1);
  });

  it('BillingDate 당일(23:59:59 KST)까지는 전이하지 않고, 00:10 KST에는 UTC 날짜가 아직 같아도 전이한다 [KST 오늘]', async () => {
    const t = await register();
    t.clock.set(JUST_BEFORE_MIDNIGHT_KST);

    expect(await t.trialTracking.runMissedBilledBatch()).toEqual({ transitioned: 0, scheduled: 0 });
    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({ status: 'TRACKING' });

    t.clock.set(BATCH_AT);
    expect(await t.trialTracking.runMissedBilledBatch()).toEqual({ transitioned: 1, scheduled: 1 });
  });

  it('종료 상태 기록과 아직 BillingDate가 지나지 않은 기록은 건드리지 않는다', async () => {
    const kept = await register();
    await kept.trialTracking.decideKeep(kept.ref);
    const voided = await register();
    await voided.trialTracking.voidTrialRecord(voided.ref);
    const confirmed = await register();
    await confirmed.trialTracking.confirmCancel({ ...confirmed.ref, exitReason: 'COMPLEX_UX' });
    const future = await registerTrial('2026-12-04T03:00:00.000Z'); // billingDate 2027-01-03
    const due = await register(); // 이 기록만 대상이다
    due.clock.set(BATCH_AT);

    const result = await due.trialTracking.runMissedBilledBatch();

    expect(result).toEqual({ transitioned: 1, scheduled: 1 });
    for (const t of [kept, voided, confirmed, future]) {
      expect(await slotsOf(t.record.id)).not.toContainEqual(
        expect.objectContaining({ slot: 'BILLING_CHECK' }),
      );
    }
    expect(await kept.trialTracking.getTrialRecord(kept.ref)).toMatchObject({ status: 'KEPT' });
    expect(await voided.trialTracking.getTrialRecord(voided.ref)).toMatchObject({
      status: 'VOIDED',
    });
    expect(await confirmed.trialTracking.getTrialRecord(confirmed.ref)).toMatchObject({
      status: 'CANCELED_CONFIRMED',
    });
    expect(await future.trialTracking.getTrialRecord(future.ref)).toMatchObject({
      status: 'TRACKING',
    });
  });

  it('여러 기록을 한 번에 처리한다', async () => {
    const a = await register();
    const b = await register();
    a.clock.set(BATCH_AT);

    expect(await a.trialTracking.runMissedBilledBatch()).toEqual({ transitioned: 2, scheduled: 2 });
    expect(await b.trialTracking.getTrialRecord(b.ref)).toMatchObject({ status: 'MISSED_BILLED' });
  });

  it('BILLING_CHECK가 빠진 MISSED_BILLED 기록을 다음 실행이 보충한다 (전이만 되고 멈춘 경우)', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);
    await forceMissedBilled(t.record.id, BATCH_AT); // 전이만 되고 알림 단계 전에 멈춘 상태

    const result = await t.trialTracking.runMissedBilledBatch();

    expect(result).toEqual({ transitioned: 0, scheduled: 1 });
    expect(await slotsOf(t.record.id)).toContainEqual(
      expect.objectContaining({
        slot: 'BILLING_CHECK',
        status: 'PENDING',
        sendAt: BILLING_CHECK_AT,
      }),
    );
  });

  it('이미 보낸 BILLING_CHECK는 다시 만들지 않는다', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);
    await t.trialTracking.runMissedBilledBatch();
    await markSlot(t.record.id, 'BILLING_CHECK', 'SENT');

    const again = await t.trialTracking.runMissedBilledBatch();

    expect(again).toEqual({ transitioned: 0, scheduled: 0 });
    expect((await slotsOf(t.record.id)).filter((s) => s.slot === 'BILLING_CHECK')).toEqual([
      expect.objectContaining({ status: 'SENT' }),
    ]);
  });

  it('발송 시각 설정(notification.sendTime)을 따른다 [G5]', async () => {
    const t = await register();
    await setSendTimeSetting('"09:30"');
    t.clock.set(BATCH_AT);

    await t.trialTracking.runMissedBilledBatch();

    expect(await slotsOf(t.record.id)).toContainEqual(
      expect.objectContaining({ slot: 'BILLING_CHECK', sendAt: '2026-12-06T00:30:00.000Z' }),
    );
  });

  it('발송 시각 설정이 올바르지 않으면 던지고 아무것도 바꾸지 않는다', async () => {
    const t = await register();
    await setSendTimeSetting('"25:99"');
    t.clock.set(BATCH_AT);

    await expect(t.trialTracking.runMissedBilledBatch()).rejects.toThrow();

    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({ status: 'TRACKING' });
    expect((await slotsOf(t.record.id)).map((s) => s.status)).not.toContain('CANCELED');
  });
});

describe('TT 결제 확인 흐름 (배치 → 발송 → 정정) [S31][S-03][T18]', () => {
  it('배치 직후에는 보내지 않고 10:00 KST에 /trials/{id} 링크의 BILLING_CHECK를 1회 보낸다', async () => {
    const t = await register();
    t.clock.set(BATCH_AT);
    await t.trialTracking.runMissedBilledBatch();

    await t.trialTracking.dispatchDueNotifications();
    expect(t.sender.calls).toEqual([]);

    t.clock.set(BILLING_CHECK_AT);
    await t.trialTracking.dispatchDueNotifications();
    await t.trialTracking.dispatchDueNotifications(); // 겹친 Cron 실행

    expect(t.sender.calls).toHaveLength(1);
    expect(t.sender.calls[0]?.notification).toMatchObject({
      kind: 'BILLING_CHECK',
      templateKey: 'BILLING_CHECK.REGULAR',
      link: `/trials/${t.record.id}`,
    });
  });

  it('"결제됐어요" 정정은 BILLED_CONFIRMED이고 합산하지 않는다', async () => {
    const t = await register();
    t.clock.set(BILLING_CHECK_AT);
    await t.trialTracking.runMissedBilledBatch();

    const resolved = await t.trialTracking.resolveMissedBilling({
      ...t.ref,
      resolution: 'BILLED',
    });

    expect(resolved).toMatchObject({ status: 'BILLED_CONFIRMED', savedAmount: null });
  });

  it('수신을 꺼 둔 사용자도 전이는 진행되고 알림만 SKIPPED다 [S44]', async () => {
    const t = await registerTrial(NOON_KST_NOV_5); // 수신처를 등록하지 않음 = 수신 거부와 같은 결과 (SPEC §6)
    t.clock.set(BATCH_AT);
    await t.trialTracking.runMissedBilledBatch();
    t.clock.set(BILLING_CHECK_AT);

    await t.trialTracking.dispatchDueNotifications();

    expect(await t.trialTracking.getTrialRecord(t.ref)).toMatchObject({ status: 'MISSED_BILLED' });
    expect(t.sender.calls).toEqual([]);
    expect(await slotsOf(t.record.id)).toContainEqual(
      expect.objectContaining({ slot: 'BILLING_CHECK', status: 'SKIPPED' }),
    );
  });
});

describe('TT 전이표 조회 [S31][T18]', () => {
  it('BILLING_DATE_PASSED가 허용되는 출발 상태는 전이표(SPEC §5)의 TRACKING·CANCEL_ATTEMPTED다', () => {
    expect(statesAllowing('BILLING_DATE_PASSED').sort()).toEqual(['CANCEL_ATTEMPTED', 'TRACKING']);
  });
});
