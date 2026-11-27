import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { seedItem } from '../support/catalog-seed';
import type { CatalogItemInput } from '../support/catalog-fixtures';
import { buildTrialTracking } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 모두 정오(KST)다
const NOV_1 = '2026-11-01T03:00:00.000Z';
const NOV_10 = '2026-11-10T03:00:00.000Z';
const HOUR = 60 * 60 * 1000;

type Ctx = ReturnType<typeof buildTrialTracking>;

/** 새 항목(글로벌 버퍼 적용: 안전 만료일 = 결제 예정일 - 1일)으로 시작일·체험 일수를 정해 등록한다 */
async function register(
  ctx: Ctx,
  userId: string,
  startDate: string,
  trialDays: number,
  itemOverrides: Partial<CatalogItemInput> = {},
) {
  const item = await seedItem(ctx.catalog, 'PUBLISHED', itemOverrides);
  const record = await ctx.trialTracking.createTrialRecord({
    userId,
    catalogItemId: item.id,
    startDate,
    trialDays,
  });
  return { item, record, ref: { userId, trialRecordId: record.id } };
}

/** 로고 업로드(T11)는 발표 범위에서 보류라 입력 명령에 로고가 없다. 값만 직접 넣어 조회 경로를 확인한다 */
async function setLogoUrl(catalogItemId: string, url: string) {
  await env.DB.prepare('UPDATE catalog_items SET logo_url = ? WHERE id = ?')
    .bind(url, catalogItemId)
    .run();
}

/**
 * 11/1에 만든 짧은 체험(기본 5일: 결제 예정일 11/6)을 11/10 배치로 MISSED_BILLED로 만든다.
 * 시계는 11/10 정오로 돌려놓는다
 */
async function registerMissedBilled(ctx: Ctx, userId: string, trialDays = 5) {
  ctx.clock.set(NOV_1);
  const made = await register(ctx, userId, '2026-11-01', trialDays);
  ctx.clock.set(NOV_10);
  await ctx.trialTracking.runMissedBilledBatch();
  return made;
}

describe('TT 내 체험 목록 [S41][S23][T19]', () => {
  it('진행 중 탭은 MISSED_BILLED를 맨 위에 두고 나머지는 안전 만료일 오름차순이며 D-Day·행동 버튼이 상태에 맞다 [S41]', async () => {
    const ctx = buildTrialTracking(NOV_1);
    const userId = await insertUser();
    const missed = await registerMissedBilled(ctx, userId);
    const late = await register(ctx, userId, '2026-11-10', 30); // 안전 만료일 12/09
    const soon = await register(ctx, userId, '2026-11-05', 10); // 안전 만료일 11/14
    const attempting = await register(ctx, userId, '2026-11-08', 10); // 안전 만료일 11/17
    await ctx.trialTracking.startCancelAttempt({ ...attempting.ref, exitReason: 'PRICE_BURDEN' });

    const { items, activeCount } = await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' });

    expect(items.map((i) => i.id)).toEqual([
      missed.record.id,
      soon.record.id,
      attempting.record.id,
      late.record.id,
    ]);
    expect(items.map((i) => i.status)).toEqual([
      'MISSED_BILLED',
      'TRACKING',
      'CANCEL_ATTEMPTED',
      'TRACKING',
    ]);
    expect(items.map((i) => i.dDayLabel)).toEqual([null, 'D-4', 'D-7', 'D-29']);
    expect(items.map((i) => i.actions)).toEqual([
      [
        'RESOLVE_BILLED',
        'RESOLVE_CANCELED_BEFORE_BILLING',
        'RESOLVE_KEEP_USING',
        'GO_TO_BRIDGE_GUIDE',
        'VIEW_REFUND_TEMPLATE',
      ],
      ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
      ['CONFIRM_CANCEL', 'GO_TO_BRIDGE', 'KEEP'],
      ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
    ]);
    expect(activeCount).toBe(4);
  });

  it('안전 만료일이 같으면 먼저 등록한 기록이 앞에 오고, MISSED_BILLED끼리도 안전 만료일 오름차순이다', async () => {
    const ctx = buildTrialTracking(NOV_1);
    const userId = await insertUser();
    // 나중에 만들었지만 안전 만료일(11/03)이 더 빠른 MISSED_BILLED가 먼저 와야 한다
    const missedLater = await registerMissedBilled(ctx, userId, 5); // 안전 만료일 11/05
    const missedEarlier = await registerMissedBilled(ctx, userId, 3); // 안전 만료일 11/03
    const first = await register(ctx, userId, '2026-11-10', 30);
    ctx.clock.advanceBy(HOUR);
    const second = await register(ctx, userId, '2026-11-10', 30);
    ctx.clock.advanceBy(HOUR);
    const third = await register(ctx, userId, '2026-11-10', 30);

    const { items } = await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' });

    expect(items.map((i) => i.id)).toEqual([
      missedEarlier.record.id,
      missedLater.record.id,
      first.record.id,
      second.record.id,
      third.record.id,
    ]);
  });

  it('지난 체험 탭은 종료 상태만 상태 변경 시각 내림차순으로 보이고 행동 버튼은 BILLED_CONFIRMED에만 있다', async () => {
    const ctx = buildTrialTracking(NOV_1);
    const userId = await insertUser();
    const billed = await registerMissedBilled(ctx, userId);
    const active = await register(ctx, userId, '2026-11-10', 30);
    const voided = await register(ctx, userId, '2026-11-10', 30);
    const kept = await register(ctx, userId, '2026-11-10', 30);
    const canceled = await register(ctx, userId, '2026-11-10', 30);
    await ctx.trialTracking.voidTrialRecord(voided.ref);
    ctx.clock.advanceBy(HOUR);
    await ctx.trialTracking.decideKeep(kept.ref);
    ctx.clock.advanceBy(HOUR);
    await ctx.trialTracking.confirmCancel({ ...canceled.ref, exitReason: 'PRICE_BURDEN' });
    ctx.clock.advanceBy(HOUR);
    await ctx.trialTracking.resolveMissedBilling({ ...billed.ref, resolution: 'BILLED' });

    const { items } = await ctx.trialTracking.listMyTrials({ userId, tab: 'PAST' });

    expect(items.map((i) => i.id)).toEqual([
      billed.record.id,
      canceled.record.id,
      kept.record.id,
      voided.record.id,
    ]);
    expect(items.map((i) => i.id)).not.toContain(active.record.id);
    expect(items.map((i) => i.actions)).toEqual([
      ['GO_TO_BRIDGE_GUIDE', 'VIEW_REFUND_TEMPLATE'],
      [],
      [],
      [],
    ]);
    // 종료된 기록에는 D-Day를 표시하지 않는다
    expect(items.map((i) => i.dDayLabel)).toEqual([null, null, null, null]);
  });

  it('누적 방어 금액과 진행 중 건수는 어느 탭을 열어도 같다', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const userId = await insertUser();
    const a = await register(ctx, userId, '2026-11-10', 30, { monthlyPrice: 12000 });
    const b = await register(ctx, userId, '2026-11-10', 30, { monthlyPrice: 8000 });
    await register(ctx, userId, '2026-11-10', 30);
    await ctx.trialTracking.confirmCancel({ ...a.ref, exitReason: 'PRICE_BURDEN' });
    await ctx.trialTracking.confirmCancel({ ...b.ref, exitReason: 'PRICE_BURDEN' });

    const active = await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' });
    const past = await ctx.trialTracking.listMyTrials({ userId, tab: 'PAST' });

    expect(active.items).toHaveLength(1);
    expect(past.items).toHaveLength(2);
    expect(active).toMatchObject({ savedAmountTotal: 20000, activeCount: 1 });
    expect(past).toMatchObject({ savedAmountTotal: 20000, activeCount: 1 });
  });

  it('합산하지 않는 기록(결제 확인·결제 전 해지 정정·유지·등록 취소)은 누적 방어 금액에 들어가지 않는다 [S41][S30]', async () => {
    const ctx = buildTrialTracking(NOV_1);
    const userId = await insertUser();
    const billed = await registerMissedBilled(ctx, userId, 5);
    const lateCancel = await registerMissedBilled(ctx, userId, 4);
    const counted = await register(ctx, userId, '2026-11-10', 30, { monthlyPrice: 12000 });
    const kept = await register(ctx, userId, '2026-11-10', 30, { monthlyPrice: 5000 });
    const voided = await register(ctx, userId, '2026-11-10', 30, { monthlyPrice: 7000 });
    await ctx.trialTracking.resolveMissedBilling({ ...billed.ref, resolution: 'BILLED' });
    await ctx.trialTracking.resolveMissedBilling({
      ...lateCancel.ref,
      resolution: 'CANCELED_BEFORE_BILLING',
      exitReason: 'PRICE_BURDEN',
    });
    await ctx.trialTracking.confirmCancel({ ...counted.ref, exitReason: 'PRICE_BURDEN' });
    await ctx.trialTracking.decideKeep(kept.ref);
    await ctx.trialTracking.voidTrialRecord(voided.ref);

    const { items, savedAmountTotal, activeCount } = await ctx.trialTracking.listMyTrials({
      userId,
      tab: 'PAST',
    });

    expect(items).toHaveLength(5);
    expect(new Map(items.map((i) => [i.id, i.savedAmount]))).toEqual(
      new Map([
        [billed.record.id, null],
        [lateCancel.record.id, null],
        [counted.record.id, 12000],
        [kept.record.id, null],
        [voided.record.id, null],
      ]),
    );
    expect(savedAmountTotal).toBe(12000);
    expect(activeCount).toBe(0);
  });

  it('같은 항목으로 끝난 기록과 새 진행 기록이 함께 있어도 각각 올바르게 보인다', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const userId = await insertUser();
    const first = await register(ctx, userId, '2026-11-10', 30, { name: '다시 쓰는 서비스' });
    await setLogoUrl(first.item.id, 'https://example.com/logo.png');
    await ctx.trialTracking.confirmCancel({ ...first.ref, exitReason: 'PRICE_BURDEN' });
    // 앞 기록이 끝났으니 같은 항목을 다시 등록할 수 있다
    const again = await ctx.trialTracking.createTrialRecord({
      userId,
      catalogItemId: first.item.id,
      startDate: '2026-11-10',
      trialDays: 30,
    });

    const active = await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' });
    const past = await ctx.trialTracking.listMyTrials({ userId, tab: 'PAST' });

    expect(active.items).toHaveLength(1);
    expect(active.items[0]).toMatchObject({
      id: again.id,
      catalogItemName: '다시 쓰는 서비스',
      catalogItemLogoUrl: 'https://example.com/logo.png',
    });
    expect(past.items).toHaveLength(1);
    expect(past.items[0]).toMatchObject({
      id: first.record.id,
      catalogItemName: '다시 쓰는 서비스',
      catalogItemLogoUrl: 'https://example.com/logo.png',
    });
  });

  it('기록이 없으면 빈 목록과 0이다', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const userId = await insertUser();

    expect(await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' })).toEqual({
      items: [],
      savedAmountTotal: 0,
      activeCount: 0,
    });
  });

  it('다른 사용자의 기록은 목록과 합계에 섞이지 않는다', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const me = await insertUser();
    const other = await insertUser();
    const mine = await register(ctx, me, '2026-11-10', 30);
    const theirs = await register(ctx, other, '2026-11-10', 30);
    await ctx.trialTracking.confirmCancel({ ...theirs.ref, exitReason: 'PRICE_BURDEN' });

    const active = await ctx.trialTracking.listMyTrials({ userId: me, tab: 'ACTIVE' });
    const past = await ctx.trialTracking.listMyTrials({ userId: me, tab: 'PAST' });

    expect(active.items.map((i) => i.id)).toEqual([mine.record.id]);
    expect(past.items).toEqual([]);
    expect(active).toMatchObject({ savedAmountTotal: 0, activeCount: 1 });
  });

  it('응답에 userId가 없고 서비스명·로고가 카탈로그에서 온다 [S41]', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const userId = await insertUser();
    const withLogo = await register(ctx, userId, '2026-11-10', 30, { name: '로고 있는 서비스' });
    const noLogo = await register(ctx, userId, '2026-11-10', 30, { name: '로고 없는 서비스' });
    await setLogoUrl(withLogo.item.id, 'https://example.com/logo.png');

    const { items } = await ctx.trialTracking.listMyTrials({ userId, tab: 'ACTIVE' });
    const byId = new Map(items.map((i) => [i.id, i]));

    expect(byId.get(withLogo.record.id)).toMatchObject({
      catalogItemName: '로고 있는 서비스',
      catalogItemLogoUrl: 'https://example.com/logo.png',
    });
    expect(byId.get(noLogo.record.id)).toMatchObject({ catalogItemName: '로고 없는 서비스' });
    expect(byId.get(noLogo.record.id)).not.toHaveProperty('catalogItemLogoUrl');
    for (const item of items) expect(item).not.toHaveProperty('userId');
  });

  it('단건 상세에도 로고가 있고 남의 기록은 NOT_FOUND다', async () => {
    const ctx = buildTrialTracking(NOV_10);
    const userId = await insertUser();
    const made = await register(ctx, userId, '2026-11-10', 30);
    await setLogoUrl(made.item.id, 'https://example.com/logo.png');

    const detail = await ctx.trialTracking.getTrialRecord(made.ref);

    expect(detail).toMatchObject({ catalogItemLogoUrl: 'https://example.com/logo.png' });
    await expect(
      ctx.trialTracking.getTrialRecord({
        userId: await insertUser(),
        trialRecordId: made.record.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
