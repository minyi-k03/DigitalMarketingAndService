import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { catalogInput, type CatalogItemInput } from '../support/catalog-fixtures';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Built = ReturnType<typeof buildLoginApp>;
type Role = 'USER' | 'OPERATOR' | 'ADMIN';

/** 해당 역할로 로그인한 세션 쿠키를 돌려준다. 역할은 DB에서 직접 지정한다(시드) */
async function loginWithRole(built: Built, role: Role) {
  const { cookie, userId } = await loginAs(built, { kakaoId: `k-admin-catalog-${role}` });
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  return cookie;
}

function call(built: Built, method: string, path: string, cookie: string, body?: unknown) {
  return built.app.request(`${ORIGIN}${path}`, {
    method,
    headers: { Cookie: cookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
}

async function createViaApi(built: Built, cookie: string, overrides = {}) {
  const res = await call(
    built,
    'POST',
    '/api/admin/catalog-items',
    cookie,
    catalogInput(overrides),
  );
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; publicationStatus: string; name: string };
}

async function createSubmittedViaApi(built: Built, cookie: string) {
  const partnerId = `partner-${crypto.randomUUID()}`;
  await env.DB.prepare(
    "INSERT INTO partners (id, company_name, contact_email, created_at) VALUES (?, '시연용 파트너', 'p@example.com', '2026-11-01T00:00:00.000Z')",
  )
    .bind(partnerId)
    .run();
  return createViaApi(built, cookie, {
    kind: 'SPONSORED_TRIAL',
    signupUrl: 'https://partner.example.com/signup',
    ownerPartnerId: partnerId,
  });
}

describe('IA 카탈로그 관리 API 접근 차단 [S47][T09]', () => {
  it('USER는 목록 조회와 등록 모두 403이고 아무것도 만들어지지 않는다', async () => {
    const built = buildLoginApp();
    const cookie = await loginWithRole(built, 'USER');
    const name = `차단-${crypto.randomUUID()}`;

    const list = await call(built, 'GET', '/api/admin/catalog-items', cookie);
    const create = await call(
      built,
      'POST',
      '/api/admin/catalog-items',
      cookie,
      catalogInput({ name }),
    );

    expect(list.status).toBe(403);
    expect(create.status).toBe(403);
    const stored = await env.DB.prepare('SELECT COUNT(*) AS n FROM catalog_items WHERE name = ?')
      .bind(name)
      .first<{ n: number }>();
    expect(stored?.n).toBe(0);
  });
});

describe('CM 카탈로그 관리 API [S38][S47][T09]', () => {
  it('OPERATOR가 등록하면 201과 서버가 정한 값이 담긴 항목을 돌려준다', async () => {
    const built = buildLoginApp();
    const cookie = await loginWithRole(built, 'OPERATOR');

    const res = await call(built, 'POST', '/api/admin/catalog-items', cookie, catalogInput());

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      kind: 'GUARDED_SERVICE',
      publicationStatus: 'PUBLISHED',
      darkPatternLevel: 'MEDIUM',
      lastVerifiedAt: '2026-11-02',
    });
  });

  it('상세·목록(게시 상태 필터 포함)으로 다시 조회할 수 있다', async () => {
    const built = buildLoginApp();
    const cookie = await loginWithRole(built, 'OPERATOR');
    const published = await createViaApi(built, cookie);
    const submitted = await createSubmittedViaApi(built, cookie);

    const detail = await call(built, 'GET', `/api/admin/catalog-items/${published.id}`, cookie);
    const list = await call(built, 'GET', '/api/admin/catalog-items', cookie);
    const filtered = await call(
      built,
      'GET',
      '/api/admin/catalog-items?publicationStatus=SUBMITTED',
      cookie,
    );

    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ id: published.id });
    const ids = async (res: Response) =>
      ((await res.json()) as { items: { id: string }[] }).items.map((i) => i.id);
    expect(await ids(list)).toEqual(expect.arrayContaining([published.id, submitted.id]));
    const filteredIds = await ids(filtered);
    expect(filteredIds).toContain(submitted.id);
    expect(filteredIds).not.toContain(published.id);
  });

  it('없는 항목은 상세·수정·상태 변경 모두 404 problem+json이다', async () => {
    const built = buildLoginApp();
    const cookie = await loginWithRole(built, 'OPERATOR');

    const responses = await Promise.all([
      call(built, 'GET', '/api/admin/catalog-items/no-such-item', cookie),
      call(built, 'PATCH', '/api/admin/catalog-items/no-such-item', cookie, {
        changes: { name: 'x' },
      }),
      call(built, 'POST', '/api/admin/catalog-items/no-such-item/publication-status', cookie, {
        to: 'UNPUBLISHED',
      }),
    ]);

    for (const res of responses) {
      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  describe('입력 검증', () => {
    it('필수 필드가 빠지면 400 VALIDATION_FAILED와 필드별 오류를 돌려준다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const withoutName: Partial<CatalogItemInput> = catalogInput();
      delete withoutName.name;

      const res = await call(built, 'POST', '/api/admin/catalog-items', cookie, withoutName);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [expect.objectContaining({ field: 'name' })],
      });
    });

    it('도메인 규칙을 어기면 400이고 어긴 필드를 알려 준다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');

      const res = await call(
        built,
        'POST',
        '/api/admin/catalog-items',
        cookie,
        catalogInput({ escapePattern: 'PC_OR_APP_FORCED' }), // forcedChannel 없음
      );

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [expect.objectContaining({ field: 'forcedChannel' })],
      });
    });

    it('알 수 없는 필드는 조용히 무시하지 않고 400이다 (kind는 수정할 수 없다)', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie);

      const res = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
        changes: { kind: 'SPONSORED_TRIAL' },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
    });
  });

  describe('수정과 변경 이력', () => {
    it('PATCH는 변경을 반영하고 GET change-logs에 이력이 남는다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie);

      const patched = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
        changes: { name: '이름 변경' },
      });
      const logs = await call(
        built,
        'GET',
        `/api/admin/catalog-items/${item.id}/change-logs`,
        cookie,
      );

      expect(patched.status).toBe(200);
      expect(await patched.json()).toMatchObject({ id: item.id, name: '이름 변경' });
      expect(logs.status).toBe(200);
      const { items } = (await logs.json()) as { items: { changes: unknown[] }[] };
      expect(items).toHaveLength(2); // 등록 + 수정
      expect(items[0]?.changes).toEqual([
        { field: 'name', before: '시연용 OTT', after: '이름 변경' },
      ]);
    });

    it('선택 필드를 null로 보내면 지워지고 응답에서 사라진다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie, {
        eduBenefit: { description: '학생 할인', url: 'https://edu.example.com' },
      });

      const patched = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
        changes: { eduBenefit: null },
      });
      const detail = await call(built, 'GET', `/api/admin/catalog-items/${item.id}`, cookie);

      expect(patched.status).toBe(200);
      expect(await patched.json()).not.toHaveProperty('eduBenefit');
      expect(await detail.json()).not.toHaveProperty('eduBenefit');
    });

    it.each(['name', 'escapeLink', 'supportContact', 'escapeGuideSteps'])(
      '필수 필드 %s에 null을 보내면 400 VALIDATION_FAILED다',
      async (field) => {
        const built = buildLoginApp();
        const cookie = await loginWithRole(built, 'OPERATOR');
        const item = await createViaApi(built, cookie);

        const res = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
          changes: { [field]: null },
        });

        expect(res.status).toBe(400);
        expect(res.headers.get('Content-Type')).toContain('application/problem+json');
        expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
      },
    );

    it('지운 결과가 도메인 규칙에 어긋나면 400이고 항목은 그대로다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie, {
        escapePattern: 'PC_OR_APP_FORCED',
        forcedChannel: 'PC_WEB',
      });

      const res = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
        changes: { forcedChannel: null },
      });
      const detail = await call(built, 'GET', `/api/admin/catalog-items/${item.id}`, cookie);

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [expect.objectContaining({ field: 'forcedChannel' })],
      });
      expect(await detail.json()).toMatchObject({ forcedChannel: 'PC_WEB' });
    });

    it('진행 중 기록 적용(applyBufferToActiveRecords)을 켜면 400이다 (T16 전까지 미지원)', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie);

      const res = await call(built, 'PATCH', `/api/admin/catalog-items/${item.id}`, cookie, {
        changes: { isGlobalTimeZoneBufferRequired: false },
        applyBufferToActiveRecords: true,
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [expect.objectContaining({ field: 'applyBufferToActiveRecords' })],
      });
    });
  });

  describe('게시 상태 변경', () => {
    it('SUBMITTED → PUBLISHED는 200이다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createSubmittedViaApi(built, cookie);

      const res = await call(
        built,
        'POST',
        `/api/admin/catalog-items/${item.id}/publication-status`,
        cookie,
        { to: 'PUBLISHED' },
      );

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ id: item.id, publicationStatus: 'PUBLISHED' });
    });

    it('허용되지 않은 전이는 409 INVALID_TRANSITION이다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie); // PUBLISHED

      const res = await call(
        built,
        'POST',
        `/api/admin/catalog-items/${item.id}/publication-status`,
        cookie,
        { to: 'REJECTED' },
      );

      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'INVALID_TRANSITION' });
    });

    it('알 수 없는 상태 값은 400이다', async () => {
      const built = buildLoginApp();
      const cookie = await loginWithRole(built, 'OPERATOR');
      const item = await createViaApi(built, cookie);

      const res = await call(
        built,
        'POST',
        `/api/admin/catalog-items/${item.id}/publication-status`,
        cookie,
        { to: 'ARCHIVED' },
      );

      expect(res.status).toBe(400);
    });
  });
});
