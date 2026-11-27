import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Problem = components['schemas']['Problem'];
type CatalogItemInput = components['schemas']['CatalogItemInput'];
type Built = ReturnType<typeof buildLoginApp>;

const ESCAPE_LINK = 'https://example.com/cancel';

function post(
  built: Built,
  path: string,
  init: { cookie?: string; body?: unknown; origin?: string },
) {
  const headers: Record<string, string> = { Origin: init.origin ?? ORIGIN };
  if (init.cookie) headers.Cookie = init.cookie;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  return built.app.request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers,
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
}

/** 로그인한 사용자와 그 사용자의 TRACKING 기록 */
async function withTrackingRecord(itemOverrides: Partial<CatalogItemInput> = {}) {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED', itemOverrides);
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, record, path: `/api/trials/${record.id}/cancel-attempts` };
}

describe('EB 사유 선택 API [S20][S21][S25][T21]', () => {
  it('PC_OR_APP_FORCED 항목의 응답은 forcedChannel·escapeLinkFallbackUrl·escapePattern을 JSON으로 직렬화한다 [D-15][G2]', async () => {
    const fallback = 'https://apps.example.com/app';
    const app = await withTrackingRecord({
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: fallback,
    });
    const pcWeb = await withTrackingRecord({
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    });

    const appRes = await post(app.built, app.path, {
      cookie: app.cookie,
      body: { exitReason: 'PRICE_BURDEN' },
    });
    const pcWebRes = await post(pcWeb.built, pcWeb.path, {
      cookie: pcWeb.cookie,
      body: { exitReason: 'PRICE_BURDEN' },
    });

    expect(appRes.status).toBe(200);
    expect(await appRes.json()).toEqual({
      escapeLink: ESCAPE_LINK,
      escapeLinkFallbackUrl: fallback,
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
    });
    expect(pcWebRes.status).toBe(200);
    expect(await pcWebRes.json()).toEqual({
      escapeLink: ESCAPE_LINK,
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    });
  });

  it("'이미 가입했어요': 기록 생성 → 중복이면 기존 id로 브릿지 진입 → 사유 선택까지 이어진다 [S46]", async () => {
    const built = buildLoginApp();
    const { cookie } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
    const item = await seedItem(built.catalog, 'PUBLISHED');
    const register = () => post(built, '/api/trials', { cookie, body: { catalogItemId: item.id } });

    const created = (await (await register()).json()) as { id: string };
    const duplicate = await register();
    const existingId = ((await duplicate.json()) as Problem).existingTrialRecordId;
    const bridge = await built.app.request(`${ORIGIN}/api/trials/${existingId}/bridge`, {
      headers: { Cookie: cookie },
    });
    const selected = await post(built, `/api/trials/${existingId}/cancel-attempts`, {
      cookie,
      body: { exitReason: 'PRICE_BURDEN' },
    });

    expect(duplicate.status).toBe(409);
    expect(existingId).toBe(created.id);
    expect(await bridge.json()).toMatchObject({ mode: 'POLL' });
    expect(selected.status).toBe(200);
    expect(await selected.json()).toEqual({
      escapeLink: ESCAPE_LINK,
      escapePattern: 'DIRECT_LINK',
    });
  });

  it('로그인 없이 호출하면 401이다', async () => {
    const { built, path } = await withTrackingRecord();

    const res = await post(built, path, { body: { exitReason: 'PRICE_BURDEN' } });

    expect(res.status).toBe(401);
  });

  it('사유를 고르면 200으로 직링크를 주고 기록은 CANCEL_ATTEMPTED가 된다', async () => {
    const { built, cookie, userId, record, path } = await withTrackingRecord();

    const res = await post(built, path, { cookie, body: { exitReason: 'PRICE_BURDEN' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ escapeLink: ESCAPE_LINK, escapePattern: 'DIRECT_LINK' });
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ status: 'CANCEL_ATTEMPTED' });
  });

  it('사유가 없거나 목록 밖이면 400 VALIDATION_FAILED이고 기록은 그대로다', async () => {
    const { built, cookie, userId, record, path } = await withTrackingRecord();

    for (const body of [{}, { exitReason: 'BORED' }, { exitReason: 'PRICE_BURDEN', extra: 1 }]) {
      const res = await post(built, path, { cookie, body });
      expect(res.status).toBe(400);
      expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
    }
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ status: 'TRACKING' });
  });

  it('이미 사유를 고른 기록은 409 INVALID_TRANSITION이고, 브릿지 조회(REENTRY)로 직링크를 받는다 [S22]', async () => {
    const { built, cookie, record, path } = await withTrackingRecord();
    await post(built, path, { cookie, body: { exitReason: 'PRICE_BURDEN' } });

    const again = await post(built, path, { cookie, body: { exitReason: 'COMPLEX_UX' } });
    const bridge = await built.app.request(`${ORIGIN}/api/trials/${record.id}/bridge`, {
      headers: { Cookie: cookie },
    });

    expect(again.status).toBe(409);
    expect(again.headers.get('Content-Type')).toContain('application/problem+json');
    expect(((await again.json()) as Problem).code).toBe('INVALID_TRANSITION');
    expect(await bridge.json()).toMatchObject({ mode: 'REENTRY', escapeLink: ESCAPE_LINK });
  });

  it('남의 기록이나 없는 기록은 404 NOT_FOUND다', async () => {
    const { built, record } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    for (const id of [record.id, crypto.randomUUID()]) {
      const res = await post(built, `/api/trials/${id}/cancel-attempts`, {
        cookie: other.cookie,
        body: { exitReason: 'PRICE_BURDEN' },
      });
      expect(res.status).toBe(404);
      expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    }
  });

  it('다른 Origin의 요청은 403이다', async () => {
    const { built, cookie, path } = await withTrackingRecord();

    const res = await post(built, path, {
      cookie,
      origin: 'https://evil.example',
      body: { exitReason: 'PRICE_BURDEN' },
    });

    expect(res.status).toBe(403);
  });
});
