import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type TrialRecordView = components['schemas']['TrialRecordView'];
type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

function postTrial(built: Built, body: unknown, headers: Record<string, string> = {}) {
  return built.app.request(`${ORIGIN}/api/trials`, {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function loggedIn(built: Built) {
  return loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
}

// buildLoginApp의 시계: 2026-11-02 10:00 KST
describe('TT 체험 기록 생성 API [S7][S8][T13]', () => {
  it('로그인 없이 호출하면 401 UNAUTHENTICATED와 loginUrl이다', async () => {
    const built = buildLoginApp();
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const res = await postTrial(built, { catalogItemId: item.id });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: expect.stringContaining('/auth/kakao/login'),
    });
  });

  it('시작일·체험 일수를 생략하면 서버가 오늘(KST)과 기본 체험 일수를 넣어 201로 만든다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED', {
      defaultTrialDays: 14,
      isGlobalTimeZoneBufferRequired: false,
    });

    const res = await postTrial(built, { catalogItemId: item.id }, { Cookie: cookie });
    const body = (await res.json()) as TrialRecordView;

    expect(res.status).toBe(201);
    expect(body).toMatchObject({
      catalogItemId: item.id,
      catalogItemName: item.name,
      source: 'MANUAL_CATALOG_SELECT',
      startDate: '2026-11-02',
      trialDays: 14,
      bufferApplied: false,
      billingDate: '2026-11-16',
      safeEndDate: '2026-11-16',
      status: 'TRACKING',
      savedAmount: null,
      dDayLabel: 'D-14',
      actions: ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
    });
    expect(typeof body.id).toBe('string');
  });

  it('응답에 사용자 식별 정보가 없다', async () => {
    const built = buildLoginApp();
    const { cookie, userId } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const res = await postTrial(built, { catalogItemId: item.id }, { Cookie: cookie });
    const text = await res.text();

    expect(res.status).toBe(201);
    expect(text).not.toContain(userId);
    expect(text).not.toContain('userId');
  });

  it.each([
    // undefined는 JSON으로 만들 때 빠지므로 필드가 없는 본문이 된다
    { name: 'catalogItemId 누락', body: { catalogItemId: undefined }, field: 'catalogItemId' },
    { name: '체험 일수 0', body: { trialDays: 0 }, field: 'trialDays' },
    { name: '체험 일수 366', body: { trialDays: 366 }, field: 'trialDays' },
    { name: '체험 일수가 정수가 아님', body: { trialDays: 1.5 }, field: 'trialDays' },
    { name: '날짜 형식이 아님', body: { startDate: '내일' }, field: 'startDate' },
    {
      name: 'P0에서 허용하지 않는 source',
      body: { source: 'SPONSORED_OUTBOUND_PROMPT' },
      field: 'source',
    },
  ])('잘못된 본문(%#: $name)은 400 VALIDATION_FAILED problem+json이다', async ({ body, field }) => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const res = await postTrial(built, { catalogItemId: item.id, ...body }, { Cookie: cookie });
    const problem = (await res.json()) as Problem;

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.errors?.map((e) => e.field)).toContain(field);
  });

  it('본문의 userId는 받지 않는다: 다른 사용자 명의로 만들 수 없다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const res = await postTrial(
      built,
      { catalogItemId: item.id, userId: 'someone-else' },
      { Cookie: cookie },
    );

    expect(res.status).toBe(400);
    expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
  });

  it('오늘 이후의 시작일은 400이고 이미 끝난 체험은 422 TRIAL_ALREADY_ENDED다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const future = await postTrial(
      built,
      { catalogItemId: item.id, startDate: '2026-11-03' },
      { Cookie: cookie },
    );
    const ended = await postTrial(
      built,
      { catalogItemId: item.id, startDate: '2026-09-01', trialDays: 30 },
      { Cookie: cookie },
    );

    expect(future.status).toBe(400);
    expect(ended.status).toBe(422);
    expect(await ended.json()).toMatchObject({ code: 'TRIAL_ALREADY_ENDED' });
  });

  it('V-08 UNPUBLISHED 항목은 422 CATALOG_ITEM_NOT_PUBLISHED이고 없는 항목은 404다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const stopped = await seedItem(built.catalog, 'UNPUBLISHED');

    const unpublished = await postTrial(built, { catalogItemId: stopped.id }, { Cookie: cookie });
    const missing = await postTrial(built, { catalogItemId: 'no-such-item' }, { Cookie: cookie });

    expect(unpublished.status).toBe(422);
    expect(await unpublished.json()).toMatchObject({ code: 'CATALOG_ITEM_NOT_PUBLISHED' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('진행 중인 기록이 있으면 409 DUPLICATE_ACTIVE_RECORD와 기존 기록 id를 돌려준다 [S11]', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');
    const first = (await (
      await postTrial(built, { catalogItemId: item.id }, { Cookie: cookie })
    ).json()) as TrialRecordView;

    const res = await postTrial(built, { catalogItemId: item.id }, { Cookie: cookie });

    expect(res.status).toBe(409);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      code: 'DUPLICATE_ACTIVE_RECORD',
      existingTrialRecordId: first.id,
    });
  });

  it('동시에 두 번 요청하면 하나는 201, 하나는 409다 [S11]', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const responses = await Promise.all([
      postTrial(built, { catalogItemId: item.id }, { Cookie: cookie }),
      postTrial(built, { catalogItemId: item.id }, { Cookie: cookie }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('Origin이 다른 요청은 403으로 막힌다 (CSRF)', async () => {
    const built = buildLoginApp();
    const { cookie } = await loggedIn(built);
    const item = await seedItem(built.catalog, 'PUBLISHED');

    const res = await postTrial(
      built,
      { catalogItemId: item.id },
      { Cookie: cookie, Origin: 'https://evil.example' },
    );

    expect(res.status).toBe(403);
  });
});
