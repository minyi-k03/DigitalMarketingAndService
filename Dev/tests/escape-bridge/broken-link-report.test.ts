import { describe, expect, it } from 'vitest';
import { seedItem } from '../support/catalog-seed';
import { registerBridgeTrial } from '../support/escape-bridge';
import { forceMissedBilled } from '../support/trial-state-seed';
import { insertUser } from '../support/user-seed';

const START_AT = '2026-11-02T01:00:00.000Z'; // 2026-11-02 10:00 KST
const HOUR = 60 * 60 * 1000;

describe('EB BrokenLinkReport 접수와 24시간 중복 제한 [S34] §10', () => {
  it('제보를 접수하면 OPEN 상태로 저장되고 제보 시점의 기록·항목이 연결된다', async () => {
    const { escapeBridge, ref, item, userId } = await registerBridgeTrial(START_AT);

    const receipt = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    expect(receipt).toEqual({ id: expect.any(String), duplicate: false });
    const { items } = await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id });
    expect(items).toEqual([
      {
        id: receipt.id,
        userId,
        catalogItemId: item.id,
        trialRecordId: ref.trialRecordId,
        target: 'ESCAPE_LINK',
        status: 'OPEN',
        createdAt: START_AT,
      },
    ]);
  });

  it('같은 사용자·항목·대상의 제보가 24시간 안에 다시 오면 새로 만들지 않고 기존 제보를 돌려준다', async () => {
    const { escapeBridge, clock, ref, item } = await registerBridgeTrial(START_AT);
    const first = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    clock.advanceBy(24 * HOUR - 1);
    const second = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    expect(second).toEqual({ id: first.id, duplicate: true });
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id })).items,
    ).toHaveLength(1);
  });

  it('24시간이 지나면 같은 제보도 새로 접수한다', async () => {
    const { escapeBridge, clock, ref, item } = await registerBridgeTrial(START_AT);
    const first = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    clock.advanceBy(24 * HOUR);
    const second = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    expect(second.duplicate).toBe(false);
    expect(second.id).not.toBe(first.id);
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id })).items,
    ).toHaveLength(2);
  });

  it('같은 제보가 동시에 들어와도 한 건만 접수되고 나머지는 그 제보를 돌려준다', async () => {
    const { escapeBridge, ref, item } = await registerBridgeTrial(START_AT);

    const receipts = await Promise.all(
      Array.from({ length: 5 }, () =>
        escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' }),
      ),
    );

    expect(receipts.filter((r) => !r.duplicate)).toHaveLength(1);
    expect(new Set(receipts.map((r) => r.id)).size).toBe(1);
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id })).items,
    ).toHaveLength(1);
  });

  it('대상(ESCAPE_LINK·ESCAPE_GUIDE)이 다르면 중복이 아니다', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT);

    const link = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    const guide = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_GUIDE' });

    expect(guide.duplicate).toBe(false);
    expect(guide.id).not.toBe(link.id);
  });

  it('같은 사용자라도 다른 카탈로그 항목에 대한 같은 대상 제보는 중복이 아니다', async () => {
    const { escapeBridge, trialTracking, catalog, userId, ref, item } =
      await registerBridgeTrial(START_AT);
    const otherItem = await seedItem(catalog, 'PUBLISHED');
    const otherRecord = await trialTracking.createTrialRecord({
      userId,
      catalogItemId: otherItem.id,
    });

    const first = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    const second = await escapeBridge.submitBrokenLinkReport({
      userId,
      trialRecordId: otherRecord.id,
      target: 'ESCAPE_LINK',
    });

    expect(second.duplicate).toBe(false);
    expect(second.id).not.toBe(first.id);
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id })).items.map((r) => r.id),
    ).toEqual([first.id]);
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: otherItem.id })).items.map(
        (r) => r.id,
      ),
    ).toEqual([second.id]);
  });

  it('중복 기준은 체험 기록이 아니라 사용자·항목·대상이다 (새 체험 기록으로 다시 제보해도 기존 제보)', async () => {
    const { escapeBridge, trialTracking, userId, ref, item } = await registerBridgeTrial(START_AT);
    const first = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    // 이전 체험이 끝나야(진행 중이 아니어야) 같은 항목으로 새 기록을 만들 수 있다
    await forceMissedBilled(ref.trialRecordId, '2026-11-02T02:00:00.000Z');
    const newer = await trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
    expect(newer.id).not.toBe(ref.trialRecordId);

    const second = await escapeBridge.submitBrokenLinkReport({
      userId,
      trialRecordId: newer.id,
      target: 'ESCAPE_LINK',
    });

    expect(second).toEqual({ id: first.id, duplicate: true });
  });

  it('다른 사용자의 같은 항목·대상 제보는 중복이 아니다', async () => {
    const { escapeBridge, trialTracking, item, ref } = await registerBridgeTrial(START_AT);
    await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    const otherUser = await insertUser();
    const other = await trialTracking.createTrialRecord({
      userId: otherUser,
      catalogItemId: item.id,
    });

    const receipt = await escapeBridge.submitBrokenLinkReport({
      userId: otherUser,
      trialRecordId: other.id,
      target: 'ESCAPE_LINK',
    });

    expect(receipt.duplicate).toBe(false);
  });

  it('남의 기록으로는 제보할 수 없다 (404 NOT_FOUND)', async () => {
    const { escapeBridge, ref, item } = await registerBridgeTrial(START_AT);
    const stranger = await insertUser();

    await expect(
      escapeBridge.submitBrokenLinkReport({
        userId: stranger,
        trialRecordId: ref.trialRecordId,
        target: 'ESCAPE_LINK',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      (await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id })).items,
    ).toHaveLength(0);
  });
});

describe('EB BrokenLinkReport 처리 상태 전환과 목록 [S40] §10', () => {
  it('OPEN 제보를 FIXED로 바꾸면 처리 시각이 기록되고 상태 필터에서 옮겨 간다', async () => {
    const { escapeBridge, clock, ref, item } = await registerBridgeTrial(START_AT);
    const { id } = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    clock.advanceBy(HOUR);

    const resolved = await escapeBridge.resolveBrokenLinkReport(id, 'FIXED');

    expect(resolved).toMatchObject({
      id,
      status: 'FIXED',
      createdAt: START_AT,
      resolvedAt: '2026-11-02T02:00:00.000Z',
    });
    const open = await escapeBridge.listBrokenLinkReports({
      status: 'OPEN',
      catalogItemId: item.id,
    });
    const fixed = await escapeBridge.listBrokenLinkReports({
      status: 'FIXED',
      catalogItemId: item.id,
    });
    expect(open.items).toHaveLength(0);
    expect(fixed.items.map((r) => r.id)).toEqual([id]);
  });

  it('REJECTED로도 바꿀 수 있다', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT);
    const { id } = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_GUIDE' });

    const resolved = await escapeBridge.resolveBrokenLinkReport(id, 'REJECTED');

    expect(resolved.status).toBe('REJECTED');
    expect(resolved.resolvedAt).toBeDefined();
  });

  it('같은 결과로 다시 처리해도 처음 처리 시각을 지킨다', async () => {
    const { escapeBridge, clock, ref } = await registerBridgeTrial(START_AT);
    const { id } = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    const first = await escapeBridge.resolveBrokenLinkReport(id, 'FIXED');

    clock.advanceBy(HOUR);
    const again = await escapeBridge.resolveBrokenLinkReport(id, 'FIXED');

    expect(again.resolvedAt).toBe(first.resolvedAt);
  });

  it('FIXED에서 REJECTED로 정정하면 상태와 처리 시각이 새 값으로 바뀐다', async () => {
    const { escapeBridge, clock, ref } = await registerBridgeTrial(START_AT);
    const { id } = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    clock.advanceBy(HOUR);
    const fixed = await escapeBridge.resolveBrokenLinkReport(id, 'FIXED');
    expect(fixed.resolvedAt).toBe('2026-11-02T02:00:00.000Z');

    clock.advanceBy(HOUR);
    const corrected = await escapeBridge.resolveBrokenLinkReport(id, 'REJECTED');

    expect(corrected).toMatchObject({
      id,
      status: 'REJECTED',
      createdAt: START_AT,
      resolvedAt: '2026-11-02T03:00:00.000Z',
    });
  });

  it('없는 제보를 처리하면 404 NOT_FOUND다', async () => {
    const { escapeBridge } = await registerBridgeTrial(START_AT);

    await expect(
      escapeBridge.resolveBrokenLinkReport('no-such-report', 'FIXED'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('처리된 제보도 24시간 안에는 중복으로 본다 (FIXED 뒤 재제보도 새로 만들지 않는다)', async () => {
    const { escapeBridge, ref } = await registerBridgeTrial(START_AT);
    const first = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    await escapeBridge.resolveBrokenLinkReport(first.id, 'FIXED');

    const second = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });

    expect(second).toEqual({ id: first.id, duplicate: true });
  });

  it('목록은 항목별로 거르고 최신 제보부터 보여 준다', async () => {
    const { escapeBridge, clock, ref, item } = await registerBridgeTrial(START_AT);
    const link = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_LINK' });
    clock.advanceBy(HOUR);
    const guide = await escapeBridge.submitBrokenLinkReport({ ...ref, target: 'ESCAPE_GUIDE' });
    const other = await registerBridgeTrial(START_AT);
    await other.escapeBridge.submitBrokenLinkReport({ ...other.ref, target: 'ESCAPE_LINK' });

    const { items } = await escapeBridge.listBrokenLinkReports({ catalogItemId: item.id });

    expect(items.map((r) => r.id)).toEqual([guide.id, link.id]);
  });
});
