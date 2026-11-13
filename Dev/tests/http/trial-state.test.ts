import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';
import { forceMissedBilled } from '../support/trial-state-seed';

type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

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

/** 로그인한 사용자와 그 사용자의 TRACKING 기록 (buildLoginApp 시계: 2026-11-02 10:00 KST) */
async function withTrackingRecord() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, record, base: `/api/trials/${record.id}` };
}

describe('TT 상태 전이 API [S10][S28][S29][S31][T14]', () => {
  it('로그인 없이 호출하면 401이다', async () => {
    const { built, base } = await withTrackingRecord();

    const res = await post(built, `${base}/keep`, {});

    expect(res.status).toBe(401);
  });

  it('유지 결정은 200 KEPT이고, 다시 하면 409 INVALID_TRANSITION problem+json이다 [S29]', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const first = await post(built, `${base}/keep`, { cookie });
    const again = await post(built, `${base}/keep`, { cookie });

    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ status: 'KEPT', actions: [] });
    expect(again.status).toBe(409);
    expect(again.headers.get('Content-Type')).toContain('application/problem+json');
    expect(((await again.json()) as Problem).code).toBe('INVALID_TRANSITION');
  });

  it('등록 취소는 200 VOIDED다 [S10]', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/void`, { cookie });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'VOIDED' });
  });

  it('남의 기록은 404 NOT_FOUND이고 상태가 바뀌지 않는다', async () => {
    const { built, userId, record, base } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    // 본문 검증(400)을 통과하는 본문을 경로마다 줘야 소유 확인(404)까지 간다
    for (const [action, body] of [
      ['keep', undefined],
      ['void', undefined],
      ['confirm-cancel', { exitReason: 'PRICE_BURDEN' }],
      ['billing-resolution', { resolution: 'BILLED' }],
    ] as const) {
      const res = await post(built, `${base}/${action}`, { cookie: other.cookie, body });
      expect(res.status, action).toBe(404);
      expect(((await res.json()) as Problem).code, action).toBe('NOT_FOUND');
    }
    expect(
      await built.trialTracking.getTrialRecord({ userId, trialRecordId: record.id }),
    ).toMatchObject({ status: 'TRACKING' });
  });

  it('TRACKING 기록을 본문 없이 해지 확정하면 422 EXIT_POLL_REQUIRED다 [S28]', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/confirm-cancel`, { cookie });

    expect(res.status).toBe(422);
    expect(((await res.json()) as Problem).code).toBe('EXIT_POLL_REQUIRED');
  });

  it('사유와 함께 해지 확정하면 200 CANCELED_CONFIRMED와 방어 금액이다 [S28][S30]', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/confirm-cancel`, {
      cookie,
      body: { exitReason: 'SHORT_TERM_GOAL_MET' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      status: 'CANCELED_CONFIRMED',
      exitReason: 'SHORT_TERM_GOAL_MET',
      savedAmount: 9900,
      confirmedAt: '2026-11-02T01:00:00.000Z',
    });
  });

  it.each([
    {
      name: '없는 사유',
      path: 'confirm-cancel',
      body: { exitReason: 'BORED' },
      field: 'exitReason',
    },
    { name: '알 수 없는 필드', path: 'confirm-cancel', body: { userId: 'x' }, field: '' },
    { name: 'resolution 누락', path: 'billing-resolution', body: {}, field: 'resolution' },
    {
      name: '없는 resolution',
      path: 'billing-resolution',
      body: { resolution: 'REFUNDED' },
      field: 'resolution',
    },
  ])('잘못된 본문($name)은 400 VALIDATION_FAILED다', async ({ path, body, field }) => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/${path}`, { cookie, body });
    const problem = (await res.json()) as Problem;

    expect(res.status).toBe(400);
    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.errors?.map((e) => e.field)).toContain(field);
  });

  it('TRACKING 기록의 결제 확인 정정은 409 INVALID_TRANSITION이다', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/billing-resolution`, {
      cookie,
      body: { resolution: 'BILLED' },
    });

    expect(res.status).toBe(409);
    expect(((await res.json()) as Problem).code).toBe('INVALID_TRANSITION');
  });

  it('MISSED_BILLED 기록의 정정: 사유 없는 결제 전 해지는 422, 결제됐어요는 200이다 [S31]', async () => {
    const { built, cookie, record, base } = await withTrackingRecord();
    await forceMissedBilled(record.id, '2026-11-02T01:00:00.000Z');

    const noReason = await post(built, `${base}/billing-resolution`, {
      cookie,
      body: { resolution: 'CANCELED_BEFORE_BILLING' },
    });
    const billed = await post(built, `${base}/billing-resolution`, {
      cookie,
      body: { resolution: 'BILLED' },
    });

    expect(noReason.status).toBe(422);
    expect(((await noReason.json()) as Problem).code).toBe('EXIT_POLL_REQUIRED');
    expect(billed.status).toBe(200);
    expect(await billed.json()).toMatchObject({ status: 'BILLED_CONFIRMED', savedAmount: null });
  });

  it('Origin이 다른 요청은 403으로 막힌다 (CSRF)', async () => {
    const { built, cookie, base } = await withTrackingRecord();

    const res = await post(built, `${base}/keep`, { cookie, origin: 'https://evil.example' });

    expect(res.status).toBe(403);
  });
});
