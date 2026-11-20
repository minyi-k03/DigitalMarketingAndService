import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

function patch(
  built: Built,
  path: string,
  init: { cookie?: string; body?: unknown; origin?: string },
) {
  const headers: Record<string, string> = { Origin: init.origin ?? ORIGIN };
  if (init.cookie) headers.Cookie = init.cookie;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  return built.app.request(`${ORIGIN}${path}`, {
    method: 'PATCH',
    headers,
    ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
  });
}

/**
 * 로그인한 사용자와 그 사용자의 TRACKING 기록.
 * buildLoginApp 시계는 2026-11-02 10:00 KST라 기본 항목(글로벌, 30일)은 결제 예정일 12-02, 안전 만료일 12-01이다
 */
async function withTrackingRecord() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, record, base: `/api/trials/${record.id}` };
}

describe('TT 기록 수정 API [S42][S-05][T16]', () => {
  it('로그인 없이 호출하면 401이다', async () => {
    const { built, base } = await withTrackingRecord();

    const res = await patch(built, base, { body: { trialDays: 20 } });

    expect(res.status).toBe(401);
  });

  it('체험 일수를 고치면 200과 다시 계산한 날짜를 돌려준다 [S42]', async () => {
    const { built, cookie, record, base } = await withTrackingRecord();

    const res = await patch(built, base, { cookie, body: { trialDays: 20 } });

    expect(res.status).toBe(200);
    // 11-02 시작 + 20일 = 결제 예정일 11-22, 안전 만료일 11-21
    expect(await res.json()).toMatchObject({
      id: record.id,
      status: 'TRACKING',
      trialDays: 20,
      billingDate: '2026-11-22',
      safeEndDate: '2026-11-21',
      actions: ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
    });
  });

  it('S-05 시작일을 고치면 200이고 이후 조회에도 반영된다', async () => {
    const { built, cookie, userId, record, base } = await withTrackingRecord();

    const res = await patch(built, base, { cookie, body: { startDate: '2026-10-30' } });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      startDate: '2026-10-30',
      billingDate: '2026-11-29',
      safeEndDate: '2026-11-28',
    });
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ startDate: '2026-10-30', safeEndDate: '2026-11-28' });
  });

  it.each([
    ['빈 본문', {}],
    ['수정할 수 없는 필드(catalogItemId)', { trialDays: 20, catalogItemId: 'other' }],
    ['수정할 수 없는 필드(source)', { source: 'MANUAL_CATALOG_SELECT' }],
    ['문자열 일수', { trialDays: '20' }],
    ['소수 일수', { trialDays: 2.5 }],
    ['0일', { trialDays: 0 }],
    ['366일', { trialDays: 366 }],
    ['형식이 틀린 시작일', { startDate: '2026/10/30' }],
  ])('%s는 400 VALIDATION_FAILED problem+json이다', async (_, body) => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await patch(built, base, { cookie, body });

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
  });

  it('미래 시작일은 도메인 검증으로 400 VALIDATION_FAILED다', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await patch(built, base, { cookie, body: { startDate: '2026-11-03' } });

    expect(res.status).toBe(400);
    expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
  });

  it('수정 뒤 결제 예정일이 오늘 이전이면 422 TRIAL_ALREADY_ENDED다', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await patch(built, base, {
      cookie,
      body: { startDate: '2026-09-01', trialDays: 10 },
    });

    expect(res.status).toBe(422);
    expect(((await res.json()) as Problem).code).toBe('TRIAL_ALREADY_ENDED');
  });

  it('수정할 수 없는 상태(KEPT)이면 409 INVALID_TRANSITION이다', async () => {
    const { built, cookie, userId, record, base } = await withTrackingRecord();
    await built.trialTracking.decideKeep({ userId, trialRecordId: record.id });

    const res = await patch(built, base, { cookie, body: { trialDays: 20 } });

    expect(res.status).toBe(409);
    expect(((await res.json()) as Problem).code).toBe('INVALID_TRANSITION');
  });

  it('남의 기록은 404 NOT_FOUND이고 기록이 바뀌지 않는다', async () => {
    const { built, userId, record, base } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    const res = await patch(built, base, { cookie: other.cookie, body: { trialDays: 20 } });

    expect(res.status).toBe(404);
    expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ trialDays: 30 });
  });

  it('다른 Origin의 요청은 403이고 기록이 바뀌지 않는다', async () => {
    const { built, cookie, userId, record, base } = await withTrackingRecord();

    const res = await patch(built, base, {
      cookie,
      origin: 'https://evil.example',
      body: { trialDays: 20 },
    });

    expect(res.status).toBe(403);
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ trialDays: 30 });
  });
});
