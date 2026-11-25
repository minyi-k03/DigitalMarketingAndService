import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { operator } from '../support/catalog-seed';
import { registerBridgeTrial } from '../support/escape-bridge';
import { forceMissedBilled } from '../support/trial-state-seed';
import { insertUser } from '../support/user-seed';

const START_AT = '2026-11-02T01:00:00.000Z'; // 2026-11-02 10:00 KST
const ESCAPE_LINK = 'https://example.com/cancel';
const FALLBACK_URL = 'https://apps.example.com/app';

describe('EB 브릿지 화면 데이터 [S16~S19][S22~S24]', () => {
  it('TRACKING은 POLL 모드로 사유 5개만 주고 직링크는 내려주지 않는다 (§7 비노출)', async () => {
    const { escapeBridge, ref, item } = await registerBridgeTrial(START_AT);

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({
      mode: 'POLL',
      trialRecordId: ref.trialRecordId,
      catalogItemName: item.name,
      escapePattern: 'DIRECT_LINK',
      escapeGuideSteps: ['설정에서 멤버십을 연다', '해지를 누른다'],
      accessRetentionPolicy: 'RETAIN_UNTIL_END',
      backupFirst: false,
      exitReasons: [
        'PRICE_BURDEN',
        'LACK_OF_FEATURES',
        'COMPLEX_UX',
        'SHORT_TERM_GOAL_MET',
        'MOVED_TO_ALTERNATIVE',
      ],
      lastVerifiedAt: item.lastVerifiedAt,
    });
    expect(view).not.toHaveProperty('escapeLink');
    expect(view).not.toHaveProperty('escapeLinkFallbackUrl');
    expect(JSON.stringify(view)).not.toContain(ESCAPE_LINK);
  });
});

describe('EB 상태별 진입 범위와 안내 모드 [S22][S23] D-09', () => {
  it('CANCEL_ATTEMPTED는 REENTRY 모드로 직링크를 주고 투표(사유)는 다시 묻지 않는다', async () => {
    const { escapeBridge, trialTracking, ref } = await registerBridgeTrial(START_AT);
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'REENTRY', escapeLink: ESCAPE_LINK });
    expect(view).not.toHaveProperty('exitReasons');
  });

  it('MISSED_BILLED는 GUIDE_ONLY 모드로 가이드와 직링크만 주고 상태를 바꾸지 않는다', async () => {
    const { escapeBridge, trialTracking, ref, record } = await registerBridgeTrial(START_AT);
    await forceMissedBilled(record.id, '2026-12-05T15:10:00.000Z');

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'GUIDE_ONLY', escapeLink: ESCAPE_LINK });
    expect(view).not.toHaveProperty('exitReasons');
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'MISSED_BILLED' });
  });

  it('BILLED_CONFIRMED도 GUIDE_ONLY 모드로 직링크를 준다', async () => {
    const { escapeBridge, trialTracking, ref, record } = await registerBridgeTrial(START_AT);
    await forceMissedBilled(record.id, '2026-12-05T15:10:00.000Z');
    await trialTracking.resolveMissedBilling({ ...ref, resolution: 'BILLED' });

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'GUIDE_ONLY', escapeLink: ESCAPE_LINK });
  });

  it.each([
    [
      'VOIDED',
      (c: Awaited<ReturnType<typeof registerBridgeTrial>>) =>
        c.trialTracking.voidTrialRecord(c.ref),
    ],
    [
      'KEPT',
      (c: Awaited<ReturnType<typeof registerBridgeTrial>>) => c.trialTracking.decideKeep(c.ref),
    ],
    [
      'CANCELED_CONFIRMED',
      (c: Awaited<ReturnType<typeof registerBridgeTrial>>) =>
        c.trialTracking.confirmCancel({ ...c.ref, exitReason: 'PRICE_BURDEN' }),
    ],
  ])('%s 기록은 진입할 수 없어 BRIDGE_NOT_AVAILABLE이다', async (_status, toEnd) => {
    const ctx = await registerBridgeTrial(START_AT);
    await toEnd(ctx);

    await expect(ctx.escapeBridge.getBridgeView(ctx.ref)).rejects.toMatchObject({
      code: 'BRIDGE_NOT_AVAILABLE',
    });
  });

  it('남의 기록이나 없는 기록은 NOT_FOUND다', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT);
    const otherUserId = await insertUser();

    await expect(
      escapeBridge.getBridgeView({ userId: otherUserId, trialRecordId: ref.trialRecordId }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      escapeBridge.getBridgeView({ userId: ref.userId, trialRecordId: crypto.randomUUID() }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('게시 중단된 항목의 기존 기록도 브릿지를 계속 이용할 수 있다 [V-08]', async () => {
    const { escapeBridge, catalog, item, ref } = await registerBridgeTrial(START_AT);
    await catalog.changePublicationStatus(operator, item.id, 'UNPUBLISHED');

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'POLL', catalogItemName: item.name });
  });
});

describe('EB 백업 우선 안내 [V-05]', () => {
  const checklist = ['영상 목록 내보내기', '다운로드한 파일 보관'];

  it('IMMEDIATE_TERMINATION이고 백업 체크리스트가 있으면 backupFirst다', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: checklist,
    });

    expect(await escapeBridge.getBridgeView(ref)).toMatchObject({
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: checklist,
      backupFirst: true,
    });
  });

  it('체크리스트가 없거나 즉시 해지 정책이 아니면 backupFirst가 아니다', async () => {
    const noChecklist = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
    });
    const retained = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'RETAIN_UNTIL_END',
      backupChecklist: checklist,
    });

    expect(await noChecklist.escapeBridge.getBridgeView(noChecklist.ref)).toMatchObject({
      backupFirst: false,
    });
    expect(await retained.escapeBridge.getBridgeView(retained.ref)).toMatchObject({
      backupFirst: false,
    });
  });
});

describe('EB 안내 모드는 가이드·직링크·제보만 쓴다 [D-09]', () => {
  it('GUIDE_ONLY는 백업 체크리스트를 주지 않고 backupFirst도 false다', async () => {
    const { escapeBridge, ref, record } = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: ['영상 목록 내보내기'],
    });
    await forceMissedBilled(record.id, '2026-12-05T15:10:00.000Z');

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'GUIDE_ONLY', backupFirst: false });
    expect(view).not.toHaveProperty('backupChecklist');
  });

  it('REENTRY는 백업 체크리스트를 계속 준다', async () => {
    const { escapeBridge, trialTracking, ref } = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: ['영상 목록 내보내기'],
    });
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(await escapeBridge.getBridgeView(ref)).toMatchObject({
      mode: 'REENTRY',
      backupChecklist: ['영상 목록 내보내기'],
      backupFirst: true,
    });
  });
});

describe('EB EscapePattern별 서버 데이터 [S24]', () => {
  const forcedApp = {
    escapePattern: 'PC_OR_APP_FORCED',
    forcedChannel: 'APP',
    escapeLinkFallbackUrl: FALLBACK_URL,
  } as const;

  it('forcedChannel은 항상 주고 escapeLinkFallbackUrl은 직링크와 같은 범위(REENTRY·GUIDE_ONLY)에서만 준다', async () => {
    const { escapeBridge, trialTracking, ref } = await registerBridgeTrial(START_AT, forcedApp);

    const poll = await escapeBridge.getBridgeView(ref);
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'COMPLEX_UX' });
    const reentry = await escapeBridge.getBridgeView(ref);

    expect(poll).toMatchObject({
      mode: 'POLL',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    });
    expect(poll).not.toHaveProperty('escapeLinkFallbackUrl');
    expect(JSON.stringify(poll)).not.toContain(FALLBACK_URL);
    expect(reentry).toMatchObject({
      mode: 'REENTRY',
      forcedChannel: 'APP',
      escapeLink: ESCAPE_LINK,
      escapeLinkFallbackUrl: FALLBACK_URL,
    });
  });

  it('SPA_MODAL_GUIDE와 DIRECT_LINK에는 forcedChannel이 없다', async () => {
    const spa = await registerBridgeTrial(START_AT, { escapePattern: 'SPA_MODAL_GUIDE' });

    const view = await spa.escapeBridge.getBridgeView(spa.ref);

    expect(view).toMatchObject({ escapePattern: 'SPA_MODAL_GUIDE' });
    expect(view).not.toHaveProperty('forcedChannel');
  });
});

describe('EB 경계 입력 [S24][V-05]', () => {
  it('GUIDE_ONLY에서도 APP 강제 항목은 forcedChannel과 escapeLinkFallbackUrl을 직링크와 함께 준다', async () => {
    const { escapeBridge, ref, record } = await registerBridgeTrial(START_AT, {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: FALLBACK_URL,
    });
    await forceMissedBilled(record.id, '2026-12-05T15:10:00.000Z');

    expect(await escapeBridge.getBridgeView(ref)).toMatchObject({
      mode: 'GUIDE_ONLY',
      forcedChannel: 'APP',
      escapeLink: ESCAPE_LINK,
      escapeLinkFallbackUrl: FALLBACK_URL,
    });
  });

  it('PC_WEB 강제 항목은 forcedChannel만 주고 대체 URL은 없다', async () => {
    const { escapeBridge, trialTracking, ref } = await registerBridgeTrial(START_AT, {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    });
    await trialTracking.startCancelAttempt({ ...ref, exitReason: 'COMPLEX_UX' });

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ mode: 'REENTRY', forcedChannel: 'PC_WEB' });
    expect(view).not.toHaveProperty('escapeLinkFallbackUrl');
  });

  it('백업 체크리스트가 빈 배열이면 backupFirst가 false이고 체크리스트도 내려주지 않는다', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT, {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: [],
    });

    const view = await escapeBridge.getBridgeView(ref);

    expect(view).toMatchObject({ backupFirst: false });
    expect(view).not.toHaveProperty('backupChecklist');
  });

  it('로고가 있는 항목만 catalogItemLogoUrl을 준다', async () => {
    const withLogo = await registerBridgeTrial(START_AT);
    const noLogo = await registerBridgeTrial(START_AT);
    // 로고는 운영자 업로드(T09 범위)로만 들어가 입력 인터페이스가 없어 테스트 준비에만 SQL을 쓴다
    await env.DB.prepare('UPDATE catalog_items SET logo_url = ? WHERE id = ?')
      .bind('https://example.com/logo.png', withLogo.item.id)
      .run();

    expect(await withLogo.escapeBridge.getBridgeView(withLogo.ref)).toMatchObject({
      catalogItemLogoUrl: 'https://example.com/logo.png',
    });
    expect(await noLogo.escapeBridge.getBridgeView(noLogo.ref)).not.toHaveProperty(
      'catalogItemLogoUrl',
    );
  });
});
