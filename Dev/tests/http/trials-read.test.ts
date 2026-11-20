import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

function get(built: Built, path: string, cookie?: string) {
  return built.app.request(`${ORIGIN}${path}`, cookie ? { headers: { Cookie: cookie } } : {});
}

/** 로그인한 사용자와 그 사용자의 TRACKING 기록 (buildLoginApp 시계: 2026-11-02 10:00 KST) */
async function withTrackingRecord() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, record };
}

describe('TT 내 체험 조회 API [S41][T19]', () => {
  it('로그인 없이 목록·상세를 호출하면 401이다', async () => {
    const { built, record } = await withTrackingRecord();

    expect((await get(built, '/api/trials?tab=ACTIVE')).status).toBe(401);
    expect((await get(built, `/api/trials/${record.id}`)).status).toBe(401);
  });

  it('목록은 탭별로 본인 기록과 요약을 200으로 돌려주고 userId는 없다', async () => {
    const { built, cookie, record } = await withTrackingRecord();

    const active = await get(built, '/api/trials?tab=ACTIVE', cookie);
    const past = await get(built, '/api/trials?tab=PAST', cookie);

    expect(active.status).toBe(200);
    const body = (await active.json()) as { items: Record<string, unknown>[] };
    expect(body).toMatchObject({ savedAmountTotal: 0, activeCount: 1 });
    expect(body.items.map((i) => i.id)).toEqual([record.id]);
    expect(body.items[0]).toMatchObject({
      status: 'TRACKING',
      actions: ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
    });
    expect(body.items[0]).not.toHaveProperty('userId');
    expect(await past.json()).toEqual({ items: [], savedAmountTotal: 0, activeCount: 1 });
  });

  it('tab이 없거나 올바르지 않으면 400 VALIDATION_FAILED problem+json이다', async () => {
    const { built, cookie } = await withTrackingRecord();

    for (const path of ['/api/trials', '/api/trials?tab=ALL', '/api/trials?tab=active']) {
      const res = await get(built, path, cookie);
      expect(res.status, path).toBe(400);
      expect(res.headers.get('Content-Type'), path).toContain('application/problem+json');
      expect(((await res.json()) as Problem).code, path).toBe('VALIDATION_FAILED');
    }
  });

  it('상세는 본인 기록을 200으로 돌려준다', async () => {
    const { built, cookie, record } = await withTrackingRecord();

    const res = await get(built, `/api/trials/${record.id}`, cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: record.id, status: 'TRACKING' });
  });

  it('남의 기록이나 없는 기록의 상세는 404 NOT_FOUND이고 목록에도 나타나지 않는다', async () => {
    const { built, record } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    const theirs = await get(built, `/api/trials/${record.id}`, other.cookie);
    const missing = await get(built, `/api/trials/${crypto.randomUUID()}`, other.cookie);
    const list = await get(built, '/api/trials?tab=ACTIVE', other.cookie);

    for (const res of [theirs, missing]) {
      expect(res.status).toBe(404);
      expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    }
    expect(await list.json()).toEqual({ items: [], savedAmountTotal: 0, activeCount: 0 });
  });
});
