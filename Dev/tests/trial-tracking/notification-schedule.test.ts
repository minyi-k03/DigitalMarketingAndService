import { env } from 'cloudflare:test';
import { afterEach, describe, expect, it } from 'vitest';
import { seedItem } from '../support/catalog-seed';
import { setSendTimeSetting, slotsOf } from '../support/trial-state-seed';
import { buildTrialTracking, registerTrial } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 2026-11-05 12:00 KST. 기본 항목(글로벌, 30일)을 오늘 등록하면 billingDate 2026-12-05, safeEndDate 2026-12-04
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';

// 같은 파일의 테스트는 D1을 공유하므로 설정을 바꾼 테스트 뒤에 기본값으로 되돌린다
afterEach(() => setSendTimeSetting('"10:00"'));

async function countRows(table: 'trial_records' | 'notification_schedules') {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

describe('TT 알림 저장: 기록 생성 [S6][S14][T16]', () => {
  it('정규 슬롯이 모두 미래이면 D3·D1 탈출 알림을 PENDING으로 저장한다 [S6]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    const record = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });

    expect(await slotsOf(record.id)).toEqual([
      {
        kind: 'ESCAPE_ALERT',
        slot: 'D3',
        variant: 'REGULAR',
        safeEndDate: '2026-12-04',
        sendAt: '2026-12-01T01:00:00.000Z', // 12-01 10:00 KST
        status: 'PENDING',
      },
      {
        kind: 'ESCAPE_ALERT',
        slot: 'D1',
        variant: 'REGULAR',
        safeEndDate: '2026-12-04',
        sendAt: '2026-12-03T01:00:00.000Z', // 12-03 10:00 KST
        status: 'PENDING',
      },
    ]);
  });

  it('정규 슬롯이 모두 지난 등록은 즉시 발송할 LATE_REGISTRATION 1건만 저장한다 [S6]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    // 30일 전에 시작해 오늘이 결제 예정일(11-05), 안전 만료일은 어제(11-04)
    const record = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: item.id,
      startDate: '2026-10-06',
    });

    expect(await slotsOf(record.id)).toEqual([
      {
        kind: 'ESCAPE_ALERT',
        slot: 'LATE_REGISTRATION',
        variant: 'LATE_BILLING_DAY',
        safeEndDate: '2026-11-04',
        sendAt: NOON_KST_NOV_5,
        status: 'PENDING',
      },
    ]);
  });

  it('G5 기본 발송 시각 설정을 새로 만드는 슬롯에 쓴다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();
    await setSendTimeSetting('"08:30"');

    const record = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });

    expect((await slotsOf(record.id)).map((s) => [s.slot, s.sendAt])).toEqual([
      ['D3', '2026-11-30T23:30:00.000Z'], // 12-01 08:30 KST
      ['D1', '2026-12-02T23:30:00.000Z'], // 12-03 08:30 KST
    ]);
  });

  it('발송 시각 설정이 올바르지 않으면 기록을 만들지 않고 오류로 알린다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();
    await setSendTimeSetting('"25:00"');
    const before = await countRows('trial_records');

    await expect(
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
    ).rejects.toThrow('notification.sendTime');
    expect(await countRows('trial_records')).toBe(before);
  });

  it('중복으로 거부된 생성은 알림을 남기지 않는다 [S7]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();
    await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
    const before = await countRows('notification_schedules');

    await expect(
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
    ).rejects.toMatchObject({ code: 'DUPLICATE_ACTIVE_RECORD' });

    expect(await countRows('notification_schedules')).toBe(before);
  });
});

// 기본 항목(글로벌, 30일): billingDate 12-05, safeEndDate 12-04. 국내 항목은 safeEndDate = billingDate = 12-05
const NOON_KST_DEC_4 = '2026-12-04T03:00:00.000Z';
const NINE_PM_KST_DEC_4 = '2026-12-04T12:00:00.000Z';
const NOON_KST_DEC_5 = '2026-12-05T03:00:00.000Z';

const registered = (overrides: Parameters<typeof registerTrial>[1] = {}) =>
  registerTrial(NOON_KST_NOV_5, overrides);

function confirmSlots(slots: Awaited<ReturnType<typeof slotsOf>>) {
  return slots.filter((s) => s.kind === 'CANCEL_CONFIRM_CHECK');
}

describe('TT 알림 저장: 사유 선택 [S14][S26][T16]', () => {
  it('D3·D1 탈출 알림을 취소하고 D1 시각의 해지 확인 알림 D1_CONFIRM을 저장한다 [S14]', async () => {
    const { clock, trialTracking, ref } = await registered();
    clock.set('2026-11-06T03:00:00.000Z');

    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(await slotsOf(ref.trialRecordId)).toEqual([
      expect.objectContaining({ slot: 'D3', status: 'CANCELED' }),
      expect.objectContaining({ slot: 'D1', status: 'CANCELED' }),
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'D1_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-12-04',
        sendAt: '2026-12-03T01:00:00.000Z', // 12-03 10:00 KST
        status: 'PENDING',
      },
    ]);
  });

  it('D1 시각이 지난 글로벌 항목은 당일 20:00 KST에 SAME_DAY_CONFIRM을 저장한다 [S14]', async () => {
    const { clock, trialTracking, ref } = await registered();
    clock.set(NOON_KST_DEC_4);

    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(confirmSlots(await slotsOf(ref.trialRecordId))).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'SAME_DAY_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-12-04',
        sendAt: '2026-12-04T11:00:00.000Z', // 12-04 20:00 KST
        status: 'PENDING',
      },
    ]);
  });

  it('글로벌 항목의 당일 확인 마감(20:00 KST) 뒤에는 해지 확인 알림을 저장하지 않는다 [S14]', async () => {
    const { clock, trialTracking, ref } = await registered();
    clock.set(NINE_PM_KST_DEC_4);

    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(confirmSlots(await slotsOf(ref.trialRecordId))).toEqual([]);
  });

  it('국내 항목을 안전 만료일 당일에 시도하면 1시간 뒤 SAME_DAY_DOMESTIC을 저장한다 [S14]', async () => {
    const { clock, trialTracking, ref } = await registered({
      isGlobalTimeZoneBufferRequired: false,
    });
    clock.set(NOON_KST_DEC_5);

    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(confirmSlots(await slotsOf(ref.trialRecordId))).toEqual([
      expect.objectContaining({
        slot: 'SAME_DAY_CONFIRM',
        variant: 'SAME_DAY_DOMESTIC',
        safeEndDate: '2026-12-05',
        sendAt: '2026-12-05T04:00:00.000Z', // 13:00 KST
      }),
    ]);
  });

  it('기록을 읽은 뒤 유지 결정이 먼저 저장되면 사유 선택은 CONFLICT이고 해지 확인 알림이 남지 않는다', async () => {
    const { trialTracking, interleaveOnce, ref } = await registered();
    interleaveOnce(() => trialTracking.decideKeep(ref));

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(confirmSlots(await slotsOf(ref.trialRecordId))).toEqual([]);
  });
});
