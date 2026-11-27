import { describe, expect, it } from 'vitest';
import { operator } from '../support/catalog-seed';
import { registerBridgeTrial } from '../support/escape-bridge';
import { forceMissedBilled } from '../support/trial-state-seed';
import { insertUser } from '../support/user-seed';

type Ctx = Awaited<ReturnType<typeof registerBridgeTrial>>;

const START_AT = '2026-11-02T01:00:00.000Z'; // 2026-11-02 10:00 KST
const MISSED_AT = '2026-12-05T15:10:00.000Z';

/** 결제 놓침(MISSED_BILLED) 상태의 기록 */
async function missedBilledTrial(itemOverrides = {}) {
  const ctx = await registerBridgeTrial(START_AT, itemOverrides);
  await forceMissedBilled(ctx.record.id, MISSED_AT);
  return ctx;
}

describe('EB RefundTemplate 자동 기입 [S32] §9', () => {
  it('국문·영문에 서비스명·체험 시작일·고객센터를 채우고 결제일·금액·이름은 빈칸으로 둔다', async () => {
    const { escapeBridge, ref, item, record } = await missedBilledTrial();

    const template = await escapeBridge.getRefundTemplate(ref);

    for (const text of [template.ko, template.en]) {
      expect(text).toContain(item.name);
      expect(text).toContain(record.startDate);
      expect(text).toContain('help@example.com');
      // 실제 결제일·결제 금액·이름은 사용자가 채우는 빈칸이다 (SPEC §9)
      expect(text.match(/\[ {2,}\]/g)).toHaveLength(3);
    }
    expect(template.ko).toMatch(/[가-힣]/);
    expect(template.en).not.toMatch(/[가-힣]/);
  });

  it('공식 결제 예정일은 참고 정보로만 내리고 본문 결제일 빈칸에는 넣지 않는다', async () => {
    const { escapeBridge, ref, record } = await missedBilledTrial();

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.referenceBillingDate).toBe(record.billingDate);
    expect(template.ko).not.toContain(record.billingDate);
    expect(template.en).not.toContain(record.billingDate);
  });

  it('고객센터가 문의 페이지 URL뿐이어도 그 URL을 기입한다', async () => {
    const { escapeBridge, ref } = await missedBilledTrial({
      supportContact: { url: 'https://example.com/help' },
    });

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.ko).toContain('https://example.com/help');
    expect(template.en).toContain('https://example.com/help');
  });

  it('이메일과 문의 페이지 URL이 모두 있으면 둘 다 라벨을 구분해 기입한다 (SPEC §2 하나 이상)', async () => {
    const { escapeBridge, ref } = await missedBilledTrial({
      supportContact: { email: 'help@example.com', url: 'https://example.com/help' },
    });

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.ko).toContain('고객센터 이메일: help@example.com');
    expect(template.ko).toContain('고객센터 문의 페이지: https://example.com/help');
    expect(template.en).toContain('Support email: help@example.com');
    expect(template.en).toContain('Support page: https://example.com/help');
  });

  it('카탈로그에서 고객센터가 바뀌면 조회 시점의 연락처를 쓴다 (SPEC §2)', async () => {
    const { escapeBridge, catalog, ref, item } = await missedBilledTrial();
    await catalog.updateCatalogItem(operator, item.id, {
      changes: { supportContact: { email: 'support@new.example.org' } },
    });

    const template = await escapeBridge.getRefundTemplate(ref);

    for (const text of [template.ko, template.en]) {
      expect(text).toContain('support@new.example.org');
      expect(text).not.toContain('help@example.com');
    }
  });

  it('게시 중단(UNPUBLISHED)된 항목의 기존 기록도 템플릿을 계속 받는다 (SPEC §2, V-08)', async () => {
    const { escapeBridge, catalog, ref, item } = await missedBilledTrial();
    await catalog.changePublicationStatus(operator, item.id, 'UNPUBLISHED');

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.ko).toContain(item.name);
  });

  it('카탈로그에서 서비스명이 바뀌면 조회 시점의 이름을 쓴다 (SPEC §2)', async () => {
    const { escapeBridge, catalog, ref, item } = await missedBilledTrial();
    await catalog.updateCatalogItem(operator, item.id, { changes: { name: '바뀐 서비스명' } });

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.ko).toContain('바뀐 서비스명');
    expect(template.ko).not.toContain(item.name);
  });
});

describe('EB RefundTemplate 제공 상태 [S32][S31] §9', () => {
  it('BILLED_CONFIRMED에서도 계속 제공한다', async () => {
    const { escapeBridge, trialTracking, ref } = await missedBilledTrial();
    await trialTracking.resolveMissedBilling({ ...ref, resolution: 'BILLED' });

    const template = await escapeBridge.getRefundTemplate(ref);

    expect(template.ko).toContain('환불');
  });

  it.each([
    ['TRACKING', () => Promise.resolve()],
    [
      'CANCEL_ATTEMPTED',
      (c: Ctx) => c.trialTracking.startCancelAttempt({ ...c.ref, exitReason: 'PRICE_BURDEN' }),
    ],
    ['KEPT', (c: Ctx) => c.trialTracking.decideKeep(c.ref)],
    ['VOIDED', (c: Ctx) => c.trialTracking.voidTrialRecord(c.ref)],
    [
      'CANCELED_CONFIRMED',
      (c: Ctx) => c.trialTracking.confirmCancel({ ...c.ref, exitReason: 'PRICE_BURDEN' }),
    ],
  ])('%s 기록은 제공하지 않고 422 사유(BRIDGE_NOT_AVAILABLE)다', async (_status, toState) => {
    const ctx = await registerBridgeTrial(START_AT);
    await toState(ctx);

    await expect(ctx.escapeBridge.getRefundTemplate(ctx.ref)).rejects.toMatchObject({
      code: 'BRIDGE_NOT_AVAILABLE',
    });
  });

  it('MISSED_BILLED에서 계속 쓸래요(KEPT)를 고르면 노출을 중단한다', async () => {
    const { escapeBridge, trialTracking, ref } = await missedBilledTrial();
    await trialTracking.resolveMissedBilling({ ...ref, resolution: 'KEEP_USING' });

    await expect(escapeBridge.getRefundTemplate(ref)).rejects.toMatchObject({
      code: 'BRIDGE_NOT_AVAILABLE',
    });
  });

  it('MISSED_BILLED에서 결제 전에 해지했어요(CANCELED_CONFIRMED)를 고르면 노출을 중단한다 (SPEC §5)', async () => {
    const { escapeBridge, trialTracking, ref } = await missedBilledTrial();
    await trialTracking.resolveMissedBilling({
      ...ref,
      resolution: 'CANCELED_BEFORE_BILLING',
      exitReason: 'PRICE_BURDEN',
    });

    await expect(escapeBridge.getRefundTemplate(ref)).rejects.toMatchObject({
      code: 'BRIDGE_NOT_AVAILABLE',
    });
  });

  it('남의 기록이나 없는 기록은 NOT_FOUND다', async () => {
    const { escapeBridge, ref } = await missedBilledTrial();
    const otherUserId = await insertUser();

    await expect(
      escapeBridge.getRefundTemplate({ userId: otherUserId, trialRecordId: ref.trialRecordId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      escapeBridge.getRefundTemplate({ userId: ref.userId, trialRecordId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
