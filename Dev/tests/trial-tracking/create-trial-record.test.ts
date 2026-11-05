import { describe, expect, it } from 'vitest';
import { seedItem } from '../support/catalog-seed';
import { buildTrialTracking } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 2026-11-05 12:00 KST
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';

describe('TT 체험 기록 생성 [S7][S8][T13]', () => {
  it('같은 사용자·같은 항목에 진행 중인 기록이 있으면 기존 기록 id와 함께 중복으로 거부한다 [S11]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();
    const first = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });

    await expect(
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_ACTIVE_RECORD',
      extensions: { existingTrialRecordId: first.id },
    });
  });

  it('다른 사용자는 같은 항목에 따로 기록을 만들 수 있다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');

    const a = await trialTracking.createTrialRecord({
      userId: await insertUser(),
      catalogItemId: item.id,
    });
    const b = await trialTracking.createTrialRecord({
      userId: await insertUser(),
      catalogItemId: item.id,
    });

    expect(a.id).not.toBe(b.id);
  });

  it('동시에 두 번 요청해도 기록은 하나만 만들어지고 나머지는 중복으로 거부된다 [S11]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    const results = await Promise.allSettled([
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
    ]);

    const created = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({
      code: 'DUPLICATE_ACTIVE_RECORD',
      extensions: { existingTrialRecordId: created[0]?.value.id },
    });
  });

  it('V-08 UNPUBLISHED 항목은 기록 생성을 거부한다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'UNPUBLISHED');
    const userId = await insertUser();

    await expect(
      trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
    ).rejects.toMatchObject({ code: 'CATALOG_ITEM_NOT_PUBLISHED' });
  });

  it.each(['SUBMITTED', 'REJECTED'] as const)(
    '공개되지 않은 %s 항목은 없는 항목과 똑같이 NOT_FOUND다',
    async (status) => {
      const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
      const item = await seedItem(catalog, status);
      const userId = await insertUser();

      await expect(
        trialTracking.createTrialRecord({ userId, catalogItemId: item.id }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  it('없는 카탈로그 항목은 NOT_FOUND다', async () => {
    const { trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const userId = await insertUser();

    await expect(
      trialTracking.createTrialRecord({ userId, catalogItemId: 'no-such-item' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each([0, 366, -5, 1.5, Number.NaN])(
    '입력 검증: 체험 일수 %s은(는) 1~365 정수가 아니므로 거부한다',
    async (trialDays) => {
      const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
      const item = await seedItem(catalog, 'PUBLISHED');
      const userId = await insertUser();

      await expect(
        trialTracking.createTrialRecord({ userId, catalogItemId: item.id, trialDays }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        extensions: { errors: [{ field: 'trialDays' }] },
      });
    },
  );

  it.each(['2026-02-30', '2026-13-01', '26-11-05', '내일'])(
    '입력 검증: 존재하지 않거나 형식이 틀린 시작일(%s)은 거부한다',
    async (startDate) => {
      const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
      const item = await seedItem(catalog, 'PUBLISHED');
      const userId = await insertUser();

      await expect(
        trialTracking.createTrialRecord({ userId, catalogItemId: item.id, startDate }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        extensions: { errors: [{ field: 'startDate' }] },
      });
    },
  );

  it('입력 검증: P0에서는 SPONSORED_OUTBOUND_PROMPT 출처를 거부한다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    await expect(
      trialTracking.createTrialRecord({
        userId,
        catalogItemId: item.id,
        source: 'SPONSORED_OUTBOUND_PROMPT',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [{ field: 'source' }] },
    });
  });

  it('입력 검증: 결제 예정일이 오늘보다 이전이면 이미 끝난 체험으로 거부한다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    // 2026-09-01 + 30일 = 2026-10-01 < 오늘 2026-11-05
    await expect(
      trialTracking.createTrialRecord({
        userId,
        catalogItemId: item.id,
        startDate: '2026-09-01',
        trialDays: 30,
      }),
    ).rejects.toMatchObject({ code: 'TRIAL_ALREADY_ENDED' });
  });

  it('입력 검증: 결제 예정일이 오늘 당일이면 아직 등록할 수 있다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    // 2026-10-06 + 30일 = 2026-11-05 = 오늘
    const record = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: item.id,
      startDate: '2026-10-06',
      trialDays: 30,
    });

    expect(record.billingDate).toBe('2026-11-05');
  });

  it('입력 검증: 오늘(KST) 이후의 시작일은 거부한다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED');
    const userId = await insertUser();

    await expect(
      trialTracking.createTrialRecord({
        userId,
        catalogItemId: item.id,
        startDate: '2026-11-06',
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [{ field: 'startDate' }] },
    });
  });

  it('Auto-fill: 시작일·체험 일수를 생략하면 오늘(KST)과 기본 체험 일수로 기록을 만든다', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED', {
      defaultTrialDays: 30,
      isGlobalTimeZoneBufferRequired: true,
    });
    const userId = await insertUser();

    const record = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });

    expect(record).toMatchObject({
      catalogItemId: item.id,
      catalogItemName: item.name,
      source: 'MANUAL_CATALOG_SELECT',
      startDate: '2026-11-05',
      trialDays: 30,
      bufferApplied: true,
      billingDate: '2026-12-05',
      safeEndDate: '2026-12-04',
      status: 'TRACKING',
      savedAmount: null,
    });
  });

  it('생성 직후 TRACKING 기록은 D-n 표기와 행동 버튼(해지하러 가기·계속 쓸래요·가입 안 했어요)을 가진다 [S10]', async () => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED', {
      defaultTrialDays: 30,
      isGlobalTimeZoneBufferRequired: true,
    });
    const userId = await insertUser();

    const record = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });

    // 오늘 2026-11-05, 안전 만료일 2026-12-04 → 29일 남음
    expect(record.dDayLabel).toBe('D-29');
    expect(record.actions).toEqual(['GO_TO_BRIDGE', 'KEEP', 'VOID']);
  });

  it.each([
    { name: '안전 만료일 당일은 D-Day', buffer: false, label: 'D-Day' },
    {
      name: '글로벌 항목의 마지막 하루(안전 만료일 다음 날)는 결제 예정일',
      buffer: true,
      label: '결제 예정일',
    },
  ])('D-Day 표기: $name', async ({ buffer, label }) => {
    const { catalog, trialTracking } = buildTrialTracking(NOON_KST_NOV_5);
    const item = await seedItem(catalog, 'PUBLISHED', { isGlobalTimeZoneBufferRequired: buffer });
    const userId = await insertUser();

    // 2026-10-06 + 30일 = 결제 예정일 2026-11-05(오늘). 버퍼가 있으면 안전 만료일은 11-04
    const record = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: item.id,
      startDate: '2026-10-06',
      trialDays: 30,
    });

    expect(record.dDayLabel).toBe(label);
  });

  // 기대값은 달력으로 직접 센 값이다. 오늘(KST)은 결제 예정일 당일 정오로 둔다.
  it.each([
    {
      name: '국내(버퍼 없음) 30일',
      start: '2026-11-05',
      days: 30,
      buffer: false,
      today: '2026-11-05',
      billing: '2026-12-05',
      safe: '2026-12-05',
    },
    {
      name: '글로벌(버퍼) 월말 1/31+1',
      start: '2027-01-31',
      days: 1,
      buffer: true,
      today: '2027-02-01',
      billing: '2027-02-01',
      safe: '2027-01-31',
    },
    {
      name: '국내 연말 12/31+1',
      start: '2026-12-31',
      days: 1,
      buffer: false,
      today: '2027-01-01',
      billing: '2027-01-01',
      safe: '2027-01-01',
    },
    {
      name: '글로벌 윤년 2/28+1은 2/29',
      start: '2028-02-28',
      days: 1,
      buffer: true,
      today: '2028-02-29',
      billing: '2028-02-29',
      safe: '2028-02-28',
    },
    {
      name: '국내 윤년 2/29+1은 3/1',
      start: '2028-02-29',
      days: 1,
      buffer: false,
      today: '2028-03-01',
      billing: '2028-03-01',
      safe: '2028-03-01',
    },
    {
      name: '국내 평년 2/28+1은 3/1',
      start: '2027-02-28',
      days: 1,
      buffer: false,
      today: '2027-03-01',
      billing: '2027-03-01',
      safe: '2027-03-01',
    },
  ])('날짜 산정: $name', async ({ start, days, buffer, today, billing, safe }) => {
    const { catalog, trialTracking } = buildTrialTracking(`${today}T03:00:00.000Z`);
    const item = await seedItem(catalog, 'PUBLISHED', { isGlobalTimeZoneBufferRequired: buffer });
    const userId = await insertUser();

    const record = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: item.id,
      startDate: start,
      trialDays: days,
    });

    expect(record).toMatchObject({
      startDate: start,
      trialDays: days,
      bufferApplied: buffer,
      billingDate: billing,
      safeEndDate: safe,
    });
  });
});
