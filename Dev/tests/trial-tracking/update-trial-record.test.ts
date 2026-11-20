import { afterEach, describe, expect, it } from 'vitest';
import {
  forceMissedBilled,
  markSlot,
  setSendTimeSetting,
  slotsOf,
} from '../support/trial-state-seed';
import { registerTrial } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 2026-11-05 12:00 KST. 기본 항목(글로벌, 30일)을 오늘 등록하면 startDate 11-05, billingDate 12-05, safeEndDate 12-04
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const NOON_KST_NOV_6 = '2026-11-06T03:00:00.000Z';
const NINE_PM_KST_NOV_6 = '2026-11-06T12:00:00.000Z';

const registered = (overrides: Parameters<typeof registerTrial>[1] = {}) =>
  registerTrial(NOON_KST_NOV_5, overrides);

type Registered = Awaited<ReturnType<typeof registered>>;

// 같은 파일의 테스트는 D1을 공유하므로 설정을 바꾼 테스트 뒤에 기본값으로 되돌린다
afterEach(() => setSendTimeSetting('"10:00"'));

/** 확인하기 쉽게 (슬롯, 마감일, 상태)만 본다. 발송 시각 순이라 같은 마감일 안에서는 D3, D1 순서다 */
async function slotSummary(trialRecordId: string) {
  return (await slotsOf(trialRecordId)).map((s) => [s.slot, s.safeEndDate, s.status]);
}

async function pendingSlots(trialRecordId: string) {
  return (await slotsOf(trialRecordId)).filter((s) => s.status === 'PENDING');
}

describe('TT 기록 수정: 재계산과 재예약 [S42][S-05][T16]', () => {
  it('TRACKING 기록의 체험 일수를 고치면 날짜를 다시 계산하고 알림을 새 날짜로 다시 예약한다 [S42]', async () => {
    const { trialTracking, ref } = await registered();

    const updated = await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });

    // 11-05 시작 + 20일 = 결제 예정일 11-25, 글로벌 버퍼로 안전 만료일 11-24
    expect(updated).toMatchObject({
      status: 'TRACKING',
      startDate: '2026-11-05',
      trialDays: 20,
      billingDate: '2026-11-25',
      safeEndDate: '2026-11-24',
    });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      trialDays: 20,
      billingDate: '2026-11-25',
      safeEndDate: '2026-11-24',
    });
    expect(
      (await slotsOf(ref.trialRecordId)).map((s) => [s.slot, s.safeEndDate, s.sendAt, s.status]),
    ).toEqual([
      ['D3', '2026-11-24', '2026-11-21T01:00:00.000Z', 'PENDING'], // 11-21 10:00 KST
      ['D1', '2026-11-24', '2026-11-23T01:00:00.000Z', 'PENDING'], // 11-23 10:00 KST
      ['D3', '2026-12-04', '2026-12-01T01:00:00.000Z', 'CANCELED'],
      ['D1', '2026-12-04', '2026-12-03T01:00:00.000Z', 'CANCELED'],
    ]);
  });

  it('S-05 TRACKING 기록의 시작일을 고치면 일수는 그대로 두고 미발송 알림을 새 날짜로 다시 예약한다', async () => {
    const { trialTracking, ref } = await registered();

    const updated = await trialTracking.updateTrialRecord({ ...ref, startDate: '2026-11-01' });

    // 11-01 시작 + 30일 = 결제 예정일 12-01, 안전 만료일 11-30
    expect(updated).toMatchObject({
      startDate: '2026-11-01',
      trialDays: 30,
      billingDate: '2026-12-01',
      safeEndDate: '2026-11-30',
    });
    expect((await pendingSlots(ref.trialRecordId)).map((s) => [s.slot, s.sendAt])).toEqual([
      ['D3', '2026-11-27T01:00:00.000Z'], // 11-27 10:00 KST
      ['D1', '2026-11-29T01:00:00.000Z'], // 11-29 10:00 KST
    ]);
  });

  it('안전 만료일이 그대로이면(시작일과 일수의 합이 같음) 예약된 알림을 그대로 둔다', async () => {
    const { trialTracking, ref } = await registered();
    const before = await slotsOf(ref.trialRecordId);
    await setSendTimeSetting('"08:30"');

    const updated = await trialTracking.updateTrialRecord({
      ...ref,
      startDate: '2026-11-04',
      trialDays: 31,
    });

    expect(updated).toMatchObject({
      startDate: '2026-11-04',
      trialDays: 31,
      billingDate: '2026-12-05',
      safeEndDate: '2026-12-04',
    });
    expect(await slotsOf(ref.trialRecordId)).toEqual(before);
  });

  it('G5 발송 시각 설정을 바꾼 뒤 재예약한 슬롯만 새 시각을 쓰고 취소된 옛 행은 건드리지 않는다', async () => {
    const { trialTracking, ref } = await registered();
    await setSendTimeSetting('"08:30"');

    await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });

    const slots = await slotsOf(ref.trialRecordId);
    expect(slots.filter((s) => s.status === 'PENDING').map((s) => [s.slot, s.sendAt])).toEqual([
      ['D3', '2026-11-20T23:30:00.000Z'], // 11-21 08:30 KST
      ['D1', '2026-11-22T23:30:00.000Z'], // 11-23 08:30 KST
    ]);
    expect(slots.filter((s) => s.status === 'CANCELED').map((s) => [s.slot, s.sendAt])).toEqual([
      ['D3', '2026-12-01T01:00:00.000Z'], // 옛 행은 옛 시각(10:00) 그대로
      ['D1', '2026-12-03T01:00:00.000Z'],
    ]);
  });

  it('정규 슬롯이 모두 지나고 오늘이 결제 예정일 이하이면 LATE_REGISTRATION을 즉시 1회 저장한다 [S6]', async () => {
    const { trialTracking, ref } = await registered();

    // 1일 체험: 결제 예정일 11-06, 안전 만료일 11-05(오늘)
    await trialTracking.updateTrialRecord({ ...ref, trialDays: 1 });

    expect(await pendingSlots(ref.trialRecordId)).toEqual([
      {
        kind: 'ESCAPE_ALERT',
        slot: 'LATE_REGISTRATION',
        variant: 'LATE_SAFE_END_DAY',
        safeEndDate: '2026-11-05',
        sendAt: NOON_KST_NOV_5,
        status: 'PENDING',
      },
    ]);
  });

  it('이미 보낸 알림(SENT)은 그대로 두고, 새 마감일 슬롯은 같은 슬롯이어도 다시 예약한다 [S42]', async () => {
    const { trialTracking, ref } = await registered();
    await markSlot(ref.trialRecordId, 'D3', 'SENT');

    await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });

    expect(await slotSummary(ref.trialRecordId)).toEqual([
      ['D3', '2026-11-24', 'PENDING'],
      ['D1', '2026-11-24', 'PENDING'],
      ['D3', '2026-12-04', 'SENT'],
      ['D1', '2026-12-04', 'CANCELED'],
    ]);
  });

  it('날짜를 원래대로 되돌려도 같은 마감일에 이미 보낸 슬롯은 다시 보내지 않는다 [S42]', async () => {
    const { trialTracking, ref } = await registered();
    await markSlot(ref.trialRecordId, 'D3', 'SENT');

    await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });
    await trialTracking.updateTrialRecord({ ...ref, trialDays: 30 });

    expect(await slotSummary(ref.trialRecordId)).toEqual([
      ['D3', '2026-11-24', 'CANCELED'],
      ['D1', '2026-11-24', 'CANCELED'],
      ['D3', '2026-12-04', 'SENT'], // 12-04 마감의 D3는 이미 나갔으므로 되살리지 않는다
      ['D1', '2026-12-04', 'PENDING'],
    ]);
  });

  it('날짜를 바꿨다가 원래대로 되돌리면 취소됐던 슬롯이 다시 PENDING이 된다', async () => {
    const { trialTracking, ref } = await registered();

    await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });
    await trialTracking.updateTrialRecord({ ...ref, trialDays: 30 });

    expect(await slotSummary(ref.trialRecordId)).toEqual([
      ['D3', '2026-11-24', 'CANCELED'],
      ['D1', '2026-11-24', 'CANCELED'],
      ['D3', '2026-12-04', 'PENDING'],
      ['D1', '2026-12-04', 'PENDING'],
    ]);
  });
});

describe('TT 기록 수정: CANCEL_ATTEMPTED [S42][S-05][T16]', () => {
  async function cancelAttempted() {
    const ctx = await registered();
    ctx.clock.set(NOON_KST_NOV_6);
    await ctx.trialTracking.startCancelAttempt({ ...ctx.ref, exitReason: 'PRICE_BURDEN' });
    return ctx;
  }

  it('상태를 유지한 채 날짜를 고치고 해지 확인 알림만 새 마감일로 다시 예약한다(탈출 알림 없음)', async () => {
    const { trialTracking, ref } = await cancelAttempted();

    const updated = await trialTracking.updateTrialRecord({ ...ref, trialDays: 20 });

    expect(updated).toMatchObject({
      status: 'CANCEL_ATTEMPTED',
      exitReason: 'PRICE_BURDEN',
      cancelAttemptedAt: NOON_KST_NOV_6,
      safeEndDate: '2026-11-24',
    });
    expect(await pendingSlots(ref.trialRecordId)).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'D1_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-11-24',
        sendAt: '2026-11-23T01:00:00.000Z', // 11-23 10:00 KST
        status: 'PENDING',
      },
    ]);
  });

  it('G3 정규 슬롯이 지난 글로벌 항목은 당일 20:00 이전이면 SAME_DAY_CONFIRM 1회를 저장한다', async () => {
    const { trialTracking, ref } = await cancelAttempted();

    // 2일 체험: 안전 만료일 11-06(오늘), D1 시각(11-05 10:00)은 지났고 마감은 오늘 20:00 KST
    await trialTracking.updateTrialRecord({ ...ref, trialDays: 2 });

    expect(await pendingSlots(ref.trialRecordId)).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'SAME_DAY_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-11-06',
        sendAt: '2026-11-06T11:00:00.000Z', // 11-06 20:00 KST
        status: 'PENDING',
      },
    ]);
  });

  it('G3 당일 확인 마감(20:00 KST) 뒤에 고치면 추가 알림 없이 예약을 모두 취소한다', async () => {
    const { clock, trialTracking, ref } = await cancelAttempted();
    clock.set(NINE_PM_KST_NOV_6);

    await trialTracking.updateTrialRecord({ ...ref, trialDays: 2 });

    expect(await pendingSlots(ref.trialRecordId)).toEqual([]);
  });
});

describe('TT 기록 수정: 거부 [S42][T16]', () => {
  it('수정 뒤 결제 예정일이 오늘 이전이면 TRIAL_ALREADY_ENDED이고 기록과 알림은 그대로다', async () => {
    const { trialTracking, ref } = await registered();
    const before = await slotsOf(ref.trialRecordId);

    await expect(
      trialTracking.updateTrialRecord({ ...ref, startDate: '2026-10-01', trialDays: 10 }),
    ).rejects.toMatchObject({ code: 'TRIAL_ALREADY_ENDED' });

    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      startDate: '2026-11-05',
      trialDays: 30,
    });
    expect(await slotsOf(ref.trialRecordId)).toEqual(before);
  });

  it.each([
    ['미래 시작일', { startDate: '2026-11-06' }, 'startDate'],
    ['없는 날짜', { startDate: '2026-02-30' }, 'startDate'],
    ['0일', { trialDays: 0 }, 'trialDays'],
    ['366일', { trialDays: 366 }, 'trialDays'],
  ] as const)('%s는 VALIDATION_FAILED다', async (_, patch, field) => {
    const { trialTracking, ref } = await registered();

    await expect(trialTracking.updateTrialRecord({ ...ref, ...patch })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field })] },
    });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ trialDays: 30 });
  });

  const REJECTED_STATES: Record<string, (c: Registered) => Promise<unknown>> = {
    KEPT: (c) => c.trialTracking.decideKeep(c.ref),
    VOIDED: (c) => c.trialTracking.voidTrialRecord(c.ref),
    CANCELED_CONFIRMED: (c) =>
      c.trialTracking.confirmCancel({ ...c.ref, exitReason: 'PRICE_BURDEN' }),
    MISSED_BILLED: (c) => forceMissedBilled(c.ref.trialRecordId, NOON_KST_NOV_6),
    BILLED_CONFIRMED: async (c) => {
      await forceMissedBilled(c.ref.trialRecordId, NOON_KST_NOV_6);
      await c.trialTracking.resolveMissedBilling({ ...c.ref, resolution: 'BILLED' });
    },
  };

  it.each(Object.keys(REJECTED_STATES))(
    '%s 상태의 기록은 수정할 수 없다(INVALID_TRANSITION)',
    async (state) => {
      const ctx = await registered();
      await REJECTED_STATES[state]?.(ctx);

      await expect(
        ctx.trialTracking.updateTrialRecord({ ...ctx.ref, trialDays: 20 }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

      expect(await ctx.trialTracking.getTrialRecord(ctx.ref)).toMatchObject({
        status: state,
        trialDays: 30,
      });
    },
  );

  it('남의 기록은 없는 기록과 똑같이 NOT_FOUND다', async () => {
    const { trialTracking, ref } = await registered();
    const stranger = await insertUser();

    await expect(
      trialTracking.updateTrialRecord({ ...ref, userId: stranger, trialDays: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      trialTracking.updateTrialRecord({ ...ref, trialRecordId: 'no-such-record', trialDays: 20 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('TT 기록 수정: 동시 요청 [S42][T16]', () => {
  it('기록을 읽은 뒤 유지 결정이 먼저 저장되면 수정은 CONFLICT이고 기록·알림을 바꾸지 않는다', async () => {
    const { trialTracking, interleaveOnce, ref } = await registered();
    interleaveOnce(() => trialTracking.decideKeep(ref));

    await expect(trialTracking.updateTrialRecord({ ...ref, trialDays: 20 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      status: 'KEPT',
      trialDays: 30,
    });
    expect(await slotSummary(ref.trialRecordId)).toEqual([
      ['D3', '2026-12-04', 'CANCELED'],
      ['D1', '2026-12-04', 'CANCELED'],
    ]);
  });

  it('기록을 읽은 뒤 다른 수정이 먼저 저장되면 CONFLICT이고 먼저 저장된 수정의 알림이 남는다', async () => {
    const { trialTracking, interleaveOnce, ref } = await registered();
    interleaveOnce(() => trialTracking.updateTrialRecord({ ...ref, trialDays: 20 }));

    await expect(trialTracking.updateTrialRecord({ ...ref, trialDays: 25 })).rejects.toMatchObject({
      code: 'CONFLICT',
    });

    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      trialDays: 20,
      safeEndDate: '2026-11-24',
    });
    // 밀린 수정(25일, 안전 만료일 11-29)이 알림을 취소하거나 새로 넣지 않았다
    expect(await slotSummary(ref.trialRecordId)).toEqual([
      ['D3', '2026-11-24', 'PENDING'],
      ['D1', '2026-11-24', 'PENDING'],
      ['D3', '2026-12-04', 'CANCELED'],
      ['D1', '2026-12-04', 'CANCELED'],
    ]);
  });
});
