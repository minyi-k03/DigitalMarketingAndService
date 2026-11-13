import { describe, expect, it } from 'vitest';
import type { CatalogItemInput } from '../support/catalog-fixtures';
import { operator, seedItem } from '../support/catalog-seed';
import {
  exitPollResponsesOf,
  forceMissedBilled,
  insertOrphanExitPoll,
  insertPendingSlot,
  slotStatusesOf,
} from '../support/trial-state-seed';
import { buildTrialTracking } from '../support/trial-tracking';
import { insertUser } from '../support/user-seed';

// 2026-11-05 12:00 KST. 기본 항목(글로벌, 30일)을 오늘 등록하면 billingDate 2026-12-05, safeEndDate 2026-12-04
const NOON_KST_NOV_5 = '2026-11-05T03:00:00.000Z';
const NOON_KST_NOV_6 = '2026-11-06T03:00:00.000Z';

async function trackingRecord(
  startAt = NOON_KST_NOV_5,
  itemOverrides: Partial<CatalogItemInput> = {},
) {
  const ctx = buildTrialTracking(startAt);
  const item = await seedItem(ctx.catalog, 'PUBLISHED', itemOverrides);
  const userId = await insertUser();
  const record = await ctx.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { ...ctx, item, userId, record };
}

describe('TT 상태 머신 [S29][T14]', () => {
  it('TRACKING 기록을 유지 결정하면 KEPT가 되고 상태 변경 시각이 바뀐다 [S29]', async () => {
    const { clock, trialTracking, userId, record } = await trackingRecord();
    clock.set(NOON_KST_NOV_6);

    const kept = await trialTracking.decideKeep({ userId, trialRecordId: record.id });

    expect(kept).toMatchObject({ id: record.id, status: 'KEPT', savedAmount: null });
    expect(kept.statusChangedAt).toBe(NOON_KST_NOV_6);
    expect(await trialTracking.getTrialRecord({ userId, trialRecordId: record.id })).toMatchObject({
      status: 'KEPT',
      statusChangedAt: NOON_KST_NOV_6,
    });
  });

  it('TRACKING 기록을 등록 취소하면 VOIDED가 된다 [S10]', async () => {
    const { trialTracking, userId, record } = await trackingRecord();

    const voided = await trialTracking.voidTrialRecord({ userId, trialRecordId: record.id });

    expect(voided).toMatchObject({ status: 'VOIDED', savedAmount: null });
  });

  it('남의 기록은 없는 기록과 똑같이 NOT_FOUND다', async () => {
    const { trialTracking, record } = await trackingRecord();
    const stranger = await insertUser();

    await expect(
      trialTracking.decideKeep({ userId: stranger, trialRecordId: record.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      trialTracking.voidTrialRecord({ userId: stranger, trialRecordId: 'no-such-record' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('종료 상태(KEPT)에서 다시 전이하려 하면 INVALID_TRANSITION이고 상태는 그대로다', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.decideKeep(ref);

    await expect(trialTracking.voidTrialRecord(ref)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    await expect(trialTracking.decideKeep(ref)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'KEPT' });
  });
});

describe('TT 해지 시도 StartCancelAttempt [S20][S21][S25][T14]', () => {
  it('사유를 고르면 응답을 저장하고 CANCEL_ATTEMPTED로 바꾼 뒤 이동할 직링크를 돌려준다 [S20][S25]', async () => {
    const { clock, trialTracking, item, userId, record } = await trackingRecord();
    clock.set(NOON_KST_NOV_6);
    const ref = { userId, trialRecordId: record.id };

    const result = await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(result).toEqual({
      escapeLink: 'https://example.com/cancel',
      escapePattern: 'DIRECT_LINK',
    });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      status: 'CANCEL_ATTEMPTED',
      exitReason: 'PRICE_BURDEN',
      cancelAttemptedAt: NOON_KST_NOV_6,
      statusChangedAt: NOON_KST_NOV_6,
    });
    expect(await exitPollResponsesOf(record.id)).toEqual([
      {
        catalog_item_id: item.id,
        service_category: 'OTT',
        reason: 'PRICE_BURDEN',
        responded_at: NOON_KST_NOV_6,
      },
    ]);
  });

  it('PC_OR_APP_FORCED·APP 항목은 대체 링크와 강제 채널을 함께 돌려준다 [S21]', async () => {
    const { trialTracking, userId, record } = await trackingRecord(NOON_KST_NOV_5, {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://example.com/app-store',
    });

    const result = await trialTracking.startCancelAttempt({
      userId,
      trialRecordId: record.id,
      exitReason: 'COMPLEX_UX',
    });

    expect(result).toEqual({
      escapeLink: 'https://example.com/cancel',
      escapeLinkFallbackUrl: 'https://example.com/app-store',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    });
  });

  it('이미 CANCEL_ATTEMPTED인 기록은 다시 사유를 고를 수 없고 기존 응답이 그대로다', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'COMPLEX_UX' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'PRICE_BURDEN' }]);
  });

  it('KEPT → CANCEL_ATTEMPTED는 불허 전이다', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.decideKeep(ref);

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(await exitPollResponsesOf(record.id)).toEqual([]);
  });

  it('CANCEL_ATTEMPTED → VOIDED는 불허 전이다', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    await expect(trialTracking.voidTrialRecord(ref)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
  });

  it('CANCEL_ATTEMPTED에서 유지 결정하면 KEPT가 되고 기존 응답은 보존된다 [S29]', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'SHORT_TERM_GOAL_MET' });

    expect(await trialTracking.decideKeep(ref)).toMatchObject({
      status: 'KEPT',
      exitReason: 'SHORT_TERM_GOAL_MET',
    });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'SHORT_TERM_GOAL_MET' }]);
  });
});

describe('TT ExitPoll 원자성 (D1 batch) [S25][T14]', () => {
  it('응답 저장이 실패하면 상태 전이도 함께 롤백된다', async () => {
    const { trialTracking, item, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    // 같은 기록의 응답 행을 미리 넣어 batch 안의 INSERT를 PK 충돌로 실패시킨다
    await insertOrphanExitPoll(record.id, item.id);

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'COMPLEX_UX' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'TRACKING' });
    expect(await trialTracking.getTrialRecord(ref)).not.toHaveProperty('exitReason');
  });

  it('TRACKING에서 확정할 때도 응답 저장이 실패하면 확정이 롤백된다', async () => {
    const { trialTracking, item, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await insertOrphanExitPoll(record.id, item.id);

    await expect(
      trialTracking.confirmCancel({ ...ref, exitReason: 'COMPLEX_UX' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      status: 'TRACKING',
      savedAmount: null,
    });
  });

  it('기록을 읽은 뒤 다른 사유 선택이 먼저 저장되면 CONFLICT이고 먼저 온 응답 1건만 남는다', async () => {
    const { trialTracking, interleaveOnce, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    interleaveOnce(() => trialTracking.startCancelAttempt({ ...ref, exitReason: 'COMPLEX_UX' }));

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'COMPLEX_UX' }]);
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({
      status: 'CANCEL_ATTEMPTED',
      exitReason: 'COMPLEX_UX',
    });
  });

  it('기록을 읽은 뒤 유지 결정이 먼저 저장되면 사유 선택은 CONFLICT이고 KEPT 기록에 응답이 생기지 않는다', async () => {
    const { trialTracking, interleaveOnce, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    interleaveOnce(() => trialTracking.decideKeep(ref));

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'KEPT' });
    expect(await exitPollResponsesOf(record.id)).toEqual([]);
  });
});

const D3_AT = '2026-12-01T01:00:00.000Z'; // 12-01 10:00 KST
const D1_AT = '2026-12-03T01:00:00.000Z'; // 12-03 10:00 KST

async function recordWithRegularSlots() {
  const ctx = await trackingRecord();
  await insertPendingSlot(ctx.record.id, 'D3', '2026-12-04', D3_AT);
  await insertPendingSlot(ctx.record.id, 'D1', '2026-12-04', D1_AT);
  return { ...ctx, ref: { userId: ctx.userId, trialRecordId: ctx.record.id } };
}

describe('TT 전이 시 알림 취소 [S13][S26][T14]', () => {
  it.each([
    ['유지 결정', 'decideKeep'],
    ['등록 취소', 'voidTrialRecord'],
  ] as const)('%s(종료 상태)로 가면 예약된 알림을 모두 취소한다', async (_, command) => {
    const { trialTracking, ref } = await recordWithRegularSlots();

    await trialTracking[command](ref);

    expect(await slotStatusesOf(ref.trialRecordId)).toEqual([
      { slot: 'D1', status: 'CANCELED' },
      { slot: 'D3', status: 'CANCELED' },
    ]);
  });

  it('TRACKING에서 확정하면 예약된 알림을 모두 취소한다', async () => {
    const { trialTracking, ref } = await recordWithRegularSlots();

    await trialTracking.confirmCancel({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(await slotStatusesOf(ref.trialRecordId)).toEqual([
      { slot: 'D1', status: 'CANCELED' },
      { slot: 'D3', status: 'CANCELED' },
    ]);
  });

  it('사유를 고르면 아직 보내지 않은 탈출 알림(D3·D1)을 취소한다', async () => {
    const { trialTracking, ref } = await recordWithRegularSlots();

    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(await slotStatusesOf(ref.trialRecordId)).toEqual([
      { slot: 'D1', status: 'CANCELED' },
      { slot: 'D3', status: 'CANCELED' },
    ]);
  });

  it('결제 확인 정정으로 종료되면 결제 확인 알림을 취소한다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();
    await insertPendingSlot(ref.trialRecordId, 'BILLING_CHECK', '2026-12-04', NOON_KST_DEC_6);

    await trialTracking.resolveMissedBilling({ ...ref, resolution: 'KEEP_USING' });

    expect(await slotStatusesOf(ref.trialRecordId)).toEqual([
      { slot: 'BILLING_CHECK', status: 'CANCELED' },
    ]);
  });

  it('전이가 롤백되면 알림 취소도 롤백된다', async () => {
    const { trialTracking, item, ref } = await recordWithRegularSlots();
    await insertOrphanExitPoll(ref.trialRecordId, item.id);

    await expect(
      trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await slotStatusesOf(ref.trialRecordId)).toEqual([
      { slot: 'D1', status: 'PENDING' },
      { slot: 'D3', status: 'PENDING' },
    ]);
  });

  it('기록을 읽은 뒤 다른 전이에 밀려 CONFLICT가 나면 알림을 건드리지 않는다', async () => {
    const { trialTracking, interleaveOnce, ref } = await recordWithRegularSlots();
    interleaveOnce(() => trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }));
    // 끼어든 사유 선택은 탈출 알림만 취소하므로 D1_CONFIRM은 남는다. 밀린 유지 결정이 이것을 취소하면 안 된다
    await insertPendingSlot(ref.trialRecordId, 'D1_CONFIRM', '2026-12-04', D1_AT);

    await expect(trialTracking.decideKeep(ref)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'CANCEL_ATTEMPTED' });
    expect(await slotStatusesOf(ref.trialRecordId)).toContainEqual({
      slot: 'D1_CONFIRM',
      status: 'PENDING',
    });
  });
});

// 기본 항목: safeEndDate 2026-12-04 (글로벌), monthlyPrice 9900
const SAFE_END_LAST_SECOND_KST = '2026-12-04T14:59:59.000Z'; // 12-04 23:59:59 KST
const DAY_AFTER_SAFE_END_KST = '2026-12-04T15:00:00.000Z'; // 12-05 00:00 KST (UTC로는 아직 12-04)

describe('TT 해지 확정과 ExitPoll 불변식 [S28][S30][T14]', () => {
  it('TRACKING에서 응답 없이 확정하면 EXIT_POLL_REQUIRED이고 기록은 그대로다 [S28]', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };

    await expect(trialTracking.confirmCancel(ref)).rejects.toMatchObject({
      code: 'EXIT_POLL_REQUIRED',
    });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'TRACKING' });
    expect(await exitPollResponsesOf(record.id)).toEqual([]);
  });

  it('TRACKING에서 응답과 함께 확정하면 응답을 저장하고 CANCELED_CONFIRMED가 된다 [S28]', async () => {
    const { clock, trialTracking, userId, record } = await trackingRecord();
    clock.set(NOON_KST_NOV_6);
    const ref = { userId, trialRecordId: record.id };

    const confirmed = await trialTracking.confirmCancel({ ...ref, exitReason: 'LACK_OF_FEATURES' });

    expect(confirmed).toMatchObject({
      status: 'CANCELED_CONFIRMED',
      exitReason: 'LACK_OF_FEATURES',
      confirmedAt: NOON_KST_NOV_6,
      statusChangedAt: NOON_KST_NOV_6,
    });
    expect(confirmed).not.toHaveProperty('cancelAttemptedAt');
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'LACK_OF_FEATURES' }]);
  });

  it('CANCEL_ATTEMPTED에서 확정하면 응답 없이도 되고, 요청에 사유가 와도 기존 응답을 보존한다 [S30]', async () => {
    const { trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    const confirmed = await trialTracking.confirmCancel({ ...ref, exitReason: 'COMPLEX_UX' });

    expect(confirmed).toMatchObject({ status: 'CANCELED_CONFIRMED', exitReason: 'PRICE_BURDEN' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'PRICE_BURDEN' }]);
  });
});

// billingDate 2026-12-05 다음 날 배치가 MISSED_BILLED로 바꾼 뒤 (12-06 12:00 KST)
const NOON_KST_DEC_6 = '2026-12-06T03:00:00.000Z';

async function missedBilledRecord(opts: { attemptedWith?: 'PRICE_BURDEN' } = {}) {
  const ctx = await trackingRecord();
  const ref = { userId: ctx.userId, trialRecordId: ctx.record.id };
  if (opts.attemptedWith) {
    await ctx.trialTracking.startCancelAttempt({ ...ref, exitReason: opts.attemptedWith });
  }
  ctx.clock.set(NOON_KST_DEC_6);
  await forceMissedBilled(ctx.record.id, NOON_KST_DEC_6);
  return { ...ctx, ref };
}

describe('TT 결제 확인 정정 [S31][T14]', () => {
  it('"결제됐어요"는 BILLED_CONFIRMED이고 합산하지 않는다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();

    expect(
      await trialTracking.resolveMissedBilling({ ...ref, resolution: 'BILLED' }),
    ).toMatchObject({ status: 'BILLED_CONFIRMED', savedAmount: null });
  });

  it('"계속 쓸래요"는 KEPT다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();

    expect(
      await trialTracking.resolveMissedBilling({ ...ref, resolution: 'KEEP_USING' }),
    ).toMatchObject({ status: 'KEPT' });
  });

  it('응답이 없던 기록의 "결제 전에 해지했어요"는 사유가 없으면 EXIT_POLL_REQUIRED다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();

    await expect(
      trialTracking.resolveMissedBilling({ ...ref, resolution: 'CANCELED_BEFORE_BILLING' }),
    ).rejects.toMatchObject({ code: 'EXIT_POLL_REQUIRED' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'MISSED_BILLED' });
    expect(await exitPollResponsesOf(ref.trialRecordId)).toEqual([]);
  });

  it('응답이 없던 기록의 "결제 전에 해지했어요"는 응답을 함께 저장하고 합산하지 않는다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();

    const resolved = await trialTracking.resolveMissedBilling({
      ...ref,
      resolution: 'CANCELED_BEFORE_BILLING',
      exitReason: 'MOVED_TO_ALTERNATIVE',
    });

    expect(resolved).toMatchObject({
      status: 'CANCELED_CONFIRMED',
      exitReason: 'MOVED_TO_ALTERNATIVE',
      confirmedAt: NOON_KST_DEC_6,
      savedAmount: null,
    });
    expect(await exitPollResponsesOf(ref.trialRecordId)).toMatchObject([
      { reason: 'MOVED_TO_ALTERNATIVE' },
    ]);
  });

  it('CANCEL_ATTEMPTED에서 넘어온 기록은 사유 없이 정정되고 기존 응답을 보존한다', async () => {
    const { trialTracking, ref } = await missedBilledRecord({ attemptedWith: 'PRICE_BURDEN' });

    const resolved = await trialTracking.resolveMissedBilling({
      ...ref,
      resolution: 'CANCELED_BEFORE_BILLING',
      exitReason: 'COMPLEX_UX',
    });

    expect(resolved).toMatchObject({ status: 'CANCELED_CONFIRMED', exitReason: 'PRICE_BURDEN' });
    expect(await exitPollResponsesOf(ref.trialRecordId)).toMatchObject([
      { reason: 'PRICE_BURDEN' },
    ]);
  });

  it('MISSED_BILLED에서 해지 확정·유지·등록 취소·해지 시도는 불허 전이다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();

    for (const attempt of [
      () => trialTracking.confirmCancel({ ...ref, exitReason: 'PRICE_BURDEN' }),
      () => trialTracking.decideKeep(ref),
      () => trialTracking.voidTrialRecord(ref),
      () => trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    }
  });

  it('TRACKING 기록은 결제 확인 정정을 할 수 없다', async () => {
    const { trialTracking, userId, record } = await trackingRecord();

    await expect(
      trialTracking.resolveMissedBilling({
        userId,
        trialRecordId: record.id,
        resolution: 'BILLED',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('BILLED_CONFIRMED에서는 어떤 전이도 할 수 없다', async () => {
    const { trialTracking, ref } = await missedBilledRecord();
    await trialTracking.resolveMissedBilling({ ...ref, resolution: 'BILLED' });

    for (const attempt of [
      () => trialTracking.resolveMissedBilling({ ...ref, resolution: 'BILLED' }),
      () =>
        trialTracking.resolveMissedBilling({
          ...ref,
          resolution: 'CANCELED_BEFORE_BILLING',
          exitReason: 'PRICE_BURDEN',
        }),
      () => trialTracking.resolveMissedBilling({ ...ref, resolution: 'KEEP_USING' }),
      () => trialTracking.confirmCancel({ ...ref, exitReason: 'PRICE_BURDEN' }),
      () => trialTracking.decideKeep(ref),
      () => trialTracking.voidTrialRecord(ref),
      () => trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' }),
    ]) {
      await expect(attempt()).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
    }
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'BILLED_CONFIRMED' });
  });
});

describe('TT SavedAmount [S30][T14]', () => {
  it('SafeEndDate 당일 23:59:59 KST 확정은 그때의 monthlyPrice를 저장한다', async () => {
    const { clock, trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });
    clock.set(SAFE_END_LAST_SECOND_KST);

    expect(await trialTracking.confirmCancel(ref)).toMatchObject({ savedAmount: 9900 });
  });

  it('SafeEndDate 다음 날 00:00 KST(UTC로는 같은 날) 확정은 합산하지 않는다', async () => {
    const { clock, trialTracking, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    clock.set(DAY_AFTER_SAFE_END_KST);

    expect(await trialTracking.confirmCancel({ ...ref, exitReason: 'PRICE_BURDEN' })).toMatchObject(
      {
        status: 'CANCELED_CONFIRMED',
        savedAmount: null,
      },
    );
  });

  it('합산한 뒤 monthlyPrice가 바뀌어도 저장된 금액은 바뀌지 않는다', async () => {
    const { catalog, trialTracking, item, userId, record } = await trackingRecord();
    const ref = { userId, trialRecordId: record.id };
    await trialTracking.confirmCancel({ ...ref, exitReason: 'PRICE_BURDEN' });

    await catalog.updateCatalogItem(operator, item.id, { changes: { monthlyPrice: 12000 } });

    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ savedAmount: 9900 });
  });

  it('KEPT·VOIDED는 합산하지 않는다', async () => {
    const kept = await trackingRecord();
    const voided = await trackingRecord();

    expect(
      await kept.trialTracking.decideKeep({ userId: kept.userId, trialRecordId: kept.record.id }),
    ).toMatchObject({ savedAmount: null });
    expect(
      await voided.trialTracking.voidTrialRecord({
        userId: voided.userId,
        trialRecordId: voided.record.id,
      }),
    ).toMatchObject({ savedAmount: null });
  });
});
