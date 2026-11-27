import { describe, expect, it } from 'vitest';
import { operator } from '../support/catalog-seed';
import { registerBridgeTrial } from '../support/escape-bridge';
import { exitPollResponsesOf, forceMissedBilled } from '../support/trial-state-seed';
import { insertUser } from '../support/user-seed';

const START_AT = '2026-11-02T01:00:00.000Z'; // 2026-11-02 10:00 KST
const ESCAPE_LINK = 'https://example.com/cancel';
const FALLBACK_URL = 'https://apps.example.com/app';

describe('EB 사유 선택 한 번으로 EscapeLink 반환 [S20][S21][S25]', () => {
  it('사유를 고르면 응답 1건 저장·CANCEL_ATTEMPTED 전이와 함께 직링크를 돌려준다', async () => {
    const { escapeBridge, trialTracking, ref, record, item } = await registerBridgeTrial(START_AT);

    const result = await escapeBridge.selectExitReason({ ...ref, exitReason: 'PRICE_BURDEN' });

    expect(result).toEqual({ escapeLink: ESCAPE_LINK, escapePattern: 'DIRECT_LINK' });
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'CANCEL_ATTEMPTED' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([
      { catalog_item_id: item.id, reason: 'PRICE_BURDEN' },
    ]);
  });

  it('PC_OR_APP_FORCED 항목은 forcedChannel·escapeLinkFallbackUrl을 함께 준다 [D-15][G2]', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT, {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: FALLBACK_URL,
    });

    const result = await escapeBridge.selectExitReason({ ...ref, exitReason: 'COMPLEX_UX' });

    expect(result).toEqual({
      escapeLink: ESCAPE_LINK,
      escapeLinkFallbackUrl: FALLBACK_URL,
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    });
  });

  it('PC_OR_APP_FORCED(PC_WEB)도 사유 선택은 똑같이 실행하고 대체 URL 없이 forcedChannel만 준다 [D-15][G2]', async () => {
    const { escapeBridge, trialTracking, ref, record } = await registerBridgeTrial(START_AT, {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    });

    const result = await escapeBridge.selectExitReason({
      ...ref,
      exitReason: 'MOVED_TO_ALTERNATIVE',
    });

    expect(result).toEqual({
      escapeLink: ESCAPE_LINK,
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    });
    expect(result).not.toHaveProperty('escapeLinkFallbackUrl');
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'CANCEL_ATTEMPTED' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([
      { reason: 'MOVED_TO_ALTERNATIVE' },
    ]);
  });
});

describe('EB 재진입 시 투표 생략 [S22]', () => {
  it('CANCEL_ATTEMPTED 기록은 브릿지 조회로 직링크를 바로 받고, 사유를 다시 고르면 409이며 응답은 그대로다', async () => {
    const { escapeBridge, trialTracking, ref, record } = await registerBridgeTrial(START_AT);
    await escapeBridge.selectExitReason({ ...ref, exitReason: 'PRICE_BURDEN' });

    const view = await escapeBridge.getBridgeView(ref);
    await expect(
      escapeBridge.selectExitReason({ ...ref, exitReason: 'LACK_OF_FEATURES' }),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });

    expect(view).toMatchObject({ mode: 'REENTRY', escapeLink: ESCAPE_LINK });
    expect(view).not.toHaveProperty('exitReasons');
    expect(await trialTracking.getTrialRecord(ref)).toMatchObject({ status: 'CANCEL_ATTEMPTED' });
    expect(await exitPollResponsesOf(record.id)).toMatchObject([{ reason: 'PRICE_BURDEN' }]);
  });
});

describe('EB 사유 선택을 거절하는 경우 [S20]', () => {
  it('MISSED_BILLED 안내 모드와 종료 상태는 사유를 받지 않고 직링크도 내려주지 않는다', async () => {
    const missed = await registerBridgeTrial(START_AT);
    await forceMissedBilled(missed.record.id, '2026-12-05T15:10:00.000Z');
    const voided = await registerBridgeTrial(START_AT);
    await voided.trialTracking.voidTrialRecord(voided.ref);

    for (const ctx of [missed, voided]) {
      await expect(
        ctx.escapeBridge.selectExitReason({ ...ctx.ref, exitReason: 'PRICE_BURDEN' }),
      ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      expect(await exitPollResponsesOf(ctx.record.id)).toEqual([]);
    }
  });

  it('남의 기록이나 없는 기록은 NOT_FOUND이고 응답이 저장되지 않는다', async () => {
    const { escapeBridge, ref, record } = await registerBridgeTrial(START_AT);
    const otherUserId = await insertUser();

    await expect(
      escapeBridge.selectExitReason({
        userId: otherUserId,
        trialRecordId: ref.trialRecordId,
        exitReason: 'PRICE_BURDEN',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      escapeBridge.selectExitReason({
        userId: ref.userId,
        trialRecordId: crypto.randomUUID(),
        exitReason: 'PRICE_BURDEN',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await exitPollResponsesOf(record.id)).toEqual([]);
  });
});

describe('EB 게시 중단 항목의 기존 기록 [V-08]', () => {
  it('UNPUBLISHED가 되어도 기존 TRACKING 기록은 사유 선택으로 직링크를 받을 수 있다', async () => {
    const { escapeBridge, catalog, item, ref } = await registerBridgeTrial(START_AT);
    await catalog.changePublicationStatus(operator, item.id, 'UNPUBLISHED');

    const result = await escapeBridge.selectExitReason({
      ...ref,
      exitReason: 'SHORT_TERM_GOAL_MET',
    });

    expect(result).toMatchObject({ escapeLink: ESCAPE_LINK });
  });
});
