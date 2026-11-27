import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';
import { forceMissedBilled } from '../support/trial-state-seed';

const MISSED_AT = '2026-12-05T15:10:00.000Z'; // 2026-12-06 00:10 KST 배치 시각

type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

function get(built: Built, path: string, cookie?: string) {
  return built.app.request(`${ORIGIN}${path}`, cookie ? { headers: { Cookie: cookie } } : {});
}

/** 로그인한 사용자와 그 사용자의 TRACKING 기록 */
async function withTrackingRecord() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, record };
}

describe('EB 환불 템플릿 API [S32][T22]', () => {
  it('로그인 없이 호출하면 401이다', async () => {
    const { built, record } = await withTrackingRecord();

    const res = await get(built, `/api/trials/${record.id}/refund-template`);

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: `/auth/kakao/login?returnTo=${encodeURIComponent(`/api/trials/${record.id}/refund-template`)}`,
    });
  });

  it('BILLED_CONFIRMED 기록도 템플릿 200을 계속 준다', async () => {
    const { built, cookie, userId, record } = await withTrackingRecord();
    await forceMissedBilled(record.id, MISSED_AT);
    await built.trialTracking.resolveMissedBilling({
      userId,
      trialRecordId: record.id,
      resolution: 'BILLED',
    });

    const res = await get(built, `/api/trials/${record.id}/refund-template`, cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ referenceBillingDate: record.billingDate });
  });

  it('MISSED_BILLED 기록은 국·영문 템플릿과 referenceBillingDate 200을 준다', async () => {
    const { built, cookie, record } = await withTrackingRecord();
    await forceMissedBilled(record.id, MISSED_AT);

    const res = await get(built, `/api/trials/${record.id}/refund-template`, cookie);

    expect(res.status).toBe(200);
    const body = (await res.json()) as components['schemas']['RefundTemplate'];
    expect(body.referenceBillingDate).toBe(record.billingDate);
    expect(body.ko).toContain('help@example.com');
    expect(body.en).toContain('help@example.com');
  });

  it('TRACKING 기록은 422 BRIDGE_NOT_AVAILABLE problem+json이다', async () => {
    const { built, cookie, record } = await withTrackingRecord();

    const res = await get(built, `/api/trials/${record.id}/refund-template`, cookie);

    expect(res.status).toBe(422);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(((await res.json()) as Problem).code).toBe('BRIDGE_NOT_AVAILABLE');
  });

  it('남의 기록이나 없는 기록은 404 NOT_FOUND다', async () => {
    const { built, record } = await withTrackingRecord();
    await forceMissedBilled(record.id, MISSED_AT);
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    for (const id of [record.id, crypto.randomUUID()]) {
      const res = await get(built, `/api/trials/${id}/refund-template`, other.cookie);
      expect(res.status).toBe(404);
      expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    }
  });
});

describe('EB 브릿지 조회 API [S16][S22][T20]', () => {
  it('로그인 없이 호출하면 401이다', async () => {
    const { built, record } = await withTrackingRecord();

    const res = await get(built, `/api/trials/${record.id}/bridge`);

    expect(res.status).toBe(401);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: `/auth/kakao/login?returnTo=${encodeURIComponent(`/api/trials/${record.id}/bridge`)}`,
    });
  });

  it('TRACKING 기록은 POLL 모드 200을 주고 직링크 URL은 본문 어디에도 없다', async () => {
    const { built, cookie, record } = await withTrackingRecord();

    const res = await get(built, `/api/trials/${record.id}/bridge`, cookie);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ mode: 'POLL', trialRecordId: record.id });
    expect(text).not.toContain('https://example.com/cancel');
  });

  it('사유를 고른 뒤(CANCEL_ATTEMPTED)에는 REENTRY 모드로 직링크를 준다', async () => {
    const { built, cookie, userId, record } = await withTrackingRecord();
    await built.trialTracking.startCancelAttempt({
      userId,
      trialRecordId: record.id,
      exitReason: 'PRICE_BURDEN',
    });

    const res = await get(built, `/api/trials/${record.id}/bridge`, cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      mode: 'REENTRY',
      escapeLink: 'https://example.com/cancel',
    });
  });

  it('남의 기록이나 없는 기록은 404 NOT_FOUND다', async () => {
    const { built, record } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    for (const id of [record.id, crypto.randomUUID()]) {
      const res = await get(built, `/api/trials/${id}/bridge`, other.cookie);
      expect(res.status).toBe(404);
      expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    }
  });

  it('종료된 기록은 422 BRIDGE_NOT_AVAILABLE problem+json이다', async () => {
    const { built, cookie, userId, record } = await withTrackingRecord();
    await built.trialTracking.voidTrialRecord({ userId, trialRecordId: record.id });

    const res = await get(built, `/api/trials/${record.id}/bridge`, cookie);

    expect(res.status).toBe(422);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(((await res.json()) as Problem).code).toBe('BRIDGE_NOT_AVAILABLE');
  });
});
