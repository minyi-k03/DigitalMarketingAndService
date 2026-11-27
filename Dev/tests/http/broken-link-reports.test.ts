import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Built = ReturnType<typeof buildLoginApp>;
type Receipt = components['schemas']['BrokenLinkReportReceipt'];
type Report = components['schemas']['BrokenLinkReport'];
type Problem = components['schemas']['Problem'];
type Target = 'ESCAPE_LINK' | 'ESCAPE_GUIDE';

function call(built: Built, method: string, path: string, cookie?: string, body?: unknown) {
  return built.app.request(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(cookie && { Cookie: cookie }),
      Origin: ORIGIN,
      'Content-Type': 'application/json',
    },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

/** 로그인한 사용자와 그 사용자의 TRACKING 기록 */
async function withTrackingRecord() {
  const built = buildLoginApp();
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
  const item = await seedItem(built.catalog, 'PUBLISHED');
  const record = await built.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { built, cookie, userId, item, record };
}

async function loginWithRole(built: Built, role: 'USER' | 'OPERATOR' | 'ADMIN') {
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-${role}-${crypto.randomUUID()}` });
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  return cookie;
}

/** 제보를 접수하고(201 확인) 접수증을 돌려준다 */
async function submitReport(built: Built, cookie: string, trialRecordId: string, target: Target) {
  const res = await call(
    built,
    'POST',
    `/api/trials/${trialRecordId}/broken-link-reports`,
    cookie,
    {
      target,
    },
  );
  expect(res.status).toBe(201);
  return (await res.json()) as Receipt;
}

/** 상태 코드와 problem+json의 code를 함께 확인한다 */
async function expectProblem(res: Response, status: number, code: Problem['code']) {
  expect(res.status).toBe(status);
  expect(res.headers.get('Content-Type')).toContain('application/problem+json');
  expect(((await res.json()) as Problem).code).toBe(code);
}

describe('EB 경로 오류 제보 API [S34][T23]', () => {
  it('새 제보는 201과 duplicate=false를, 24시간 안의 같은 제보는 200과 기존 id를 돌려준다', async () => {
    const { built, cookie, record } = await withTrackingRecord();
    const path = `/api/trials/${record.id}/broken-link-reports`;

    const first = await call(built, 'POST', path, cookie, { target: 'ESCAPE_LINK' });
    const second = await call(built, 'POST', path, cookie, { target: 'ESCAPE_LINK' });

    expect(first.status).toBe(201);
    const created = (await first.json()) as Receipt;
    expect(created.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ id: created.id, duplicate: true });
  });

  it('로그인 없이 호출하면 401 UNAUTHENTICATED다', async () => {
    const { built, record } = await withTrackingRecord();

    const res = await call(
      built,
      'POST',
      `/api/trials/${record.id}/broken-link-reports`,
      undefined,
      { target: 'ESCAPE_LINK' },
    );

    await expectProblem(res, 401, 'UNAUTHENTICATED');
  });

  it('남의 기록이나 없는 기록은 404 NOT_FOUND다', async () => {
    const { built, record } = await withTrackingRecord();
    const other = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    const foreign = await call(
      built,
      'POST',
      `/api/trials/${record.id}/broken-link-reports`,
      other.cookie,
      { target: 'ESCAPE_LINK' },
    );
    const missing = await call(
      built,
      'POST',
      '/api/trials/no-such-record/broken-link-reports',
      other.cookie,
      { target: 'ESCAPE_LINK' },
    );

    await expectProblem(foreign, 404, 'NOT_FOUND');
    await expectProblem(missing, 404, 'NOT_FOUND');
  });

  it('알 수 없는 대상·빈 본문·알 수 없는 필드는 400 VALIDATION_FAILED이고 접수되지 않는다', async () => {
    const { built, cookie, item, record } = await withTrackingRecord();
    const path = `/api/trials/${record.id}/broken-link-reports`;

    const badTarget = await call(built, 'POST', path, cookie, { target: 'ESCAPE_PAGE' });
    const noTarget = await call(built, 'POST', path, cookie, {});
    const extraField = await call(built, 'POST', path, cookie, {
      target: 'ESCAPE_LINK',
      catalogItemId: 'other-item',
    });

    await expectProblem(badTarget, 400, 'VALIDATION_FAILED');
    await expectProblem(noTarget, 400, 'VALIDATION_FAILED');
    await expectProblem(extraField, 400, 'VALIDATION_FAILED');
    const { items } = await built.escapeBridge.listBrokenLinkReports({ catalogItemId: item.id });
    expect(items).toHaveLength(0);
  });
});

describe('EB 경로 오류 제보 관리 API [S40][T23]', () => {
  it('로그인 없이 관리 API를 부르면 401 UNAUTHENTICATED다', async () => {
    const built = buildLoginApp();

    const list = await call(built, 'GET', '/api/admin/broken-link-reports');
    const patch = await call(built, 'PATCH', '/api/admin/broken-link-reports/x', undefined, {
      status: 'FIXED',
    });

    await expectProblem(list, 401, 'UNAUTHENTICATED');
    await expectProblem(patch, 401, 'UNAUTHENTICATED');
  });

  it('USER는 목록·상태 변경 모두 403 FORBIDDEN이고 제보는 그대로 OPEN이다', async () => {
    const { built, cookie, record } = await withTrackingRecord();
    const receipt = await submitReport(built, cookie, record.id, 'ESCAPE_LINK');
    const user = await loginWithRole(built, 'USER');

    const list = await call(built, 'GET', '/api/admin/broken-link-reports', user);
    const patch = await call(built, 'PATCH', `/api/admin/broken-link-reports/${receipt.id}`, user, {
      status: 'FIXED',
    });

    await expectProblem(list, 403, 'FORBIDDEN');
    await expectProblem(patch, 403, 'FORBIDDEN');
    const after = await built.escapeBridge.listBrokenLinkReports({ status: 'OPEN' });
    expect(after.items.map((r) => r.id)).toContain(receipt.id);
  });

  it('OPERATOR는 항목·상태로 거른 목록을 보고 제보를 FIXED로 처리한다', async () => {
    const { built, cookie, item, record } = await withTrackingRecord();
    const receipt = await submitReport(built, cookie, record.id, 'ESCAPE_GUIDE');
    const operator = await loginWithRole(built, 'OPERATOR');
    const listPath = `/api/admin/broken-link-reports?catalogItemId=${item.id}`;

    const open = await call(built, 'GET', `${listPath}&status=OPEN`, operator);
    const patched = await call(
      built,
      'PATCH',
      `/api/admin/broken-link-reports/${receipt.id}`,
      operator,
      { status: 'FIXED' },
    );
    const stillOpen = await call(built, 'GET', `${listPath}&status=OPEN`, operator);

    expect(open.status).toBe(200);
    expect(((await open.json()) as { items: Report[] }).items).toMatchObject([
      { id: receipt.id, status: 'OPEN', target: 'ESCAPE_GUIDE', catalogItemId: item.id },
    ]);
    expect(patched.status).toBe(200);
    expect(await patched.json()).toMatchObject({ id: receipt.id, status: 'FIXED' });
    expect(((await stillOpen.json()) as { items: Report[] }).items).toHaveLength(0);
  });

  it('없는 제보는 404 NOT_FOUND다', async () => {
    const built = buildLoginApp();
    const operator = await loginWithRole(built, 'OPERATOR');

    const res = await call(
      built,
      'PATCH',
      '/api/admin/broken-link-reports/no-such-report',
      operator,
      {
        status: 'FIXED',
      },
    );

    await expectProblem(res, 404, 'NOT_FOUND');
  });

  it('OPEN으로 되돌리기·알 수 없는 상태·알 수 없는 필드·잘못된 쿼리는 400 VALIDATION_FAILED다', async () => {
    const { built, cookie, record } = await withTrackingRecord();
    const receipt = await submitReport(built, cookie, record.id, 'ESCAPE_LINK');
    const operator = await loginWithRole(built, 'OPERATOR');
    const patchPath = `/api/admin/broken-link-reports/${receipt.id}`;

    const reopen = await call(built, 'PATCH', patchPath, operator, { status: 'OPEN' });
    const unknownStatus = await call(built, 'PATCH', patchPath, operator, { status: 'DONE' });
    const extraField = await call(built, 'PATCH', patchPath, operator, {
      status: 'FIXED',
      resolvedAt: '2026-01-01T00:00:00.000Z',
    });
    const badStatusFilter = await call(
      built,
      'GET',
      '/api/admin/broken-link-reports?status=DONE',
      operator,
    );
    const emptyItemFilter = await call(
      built,
      'GET',
      '/api/admin/broken-link-reports?catalogItemId=',
      operator,
    );

    for (const res of [reopen, unknownStatus, extraField, badStatusFilter, emptyItemFilter]) {
      await expectProblem(res, 400, 'VALIDATION_FAILED');
    }
    // 거부된 요청은 제보를 바꾸지 않는다
    const { items } = await built.escapeBridge.listBrokenLinkReports({ status: 'OPEN' });
    expect(items.map((r) => r.id)).toContain(receipt.id);
  });
});
