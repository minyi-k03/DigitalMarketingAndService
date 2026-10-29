import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { requireRole } from '../../src/worker/http/middleware/role';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Role = 'USER' | 'OPERATOR' | 'ADMIN';

/** 관리 API는 아직 없으므로 테스트 전용 라우트로 가드를 확인한다 */
function buildAdminApp() {
  const built = buildLoginApp();
  const { app } = built;
  app.get('/api/admin/_test/operator', (c) => c.json({ ok: true }));
  app.get('/api/admin/_test/admin-only', requireRole('ADMIN'), (c) => c.json({ ok: true }));
  // /api/admin 밖에 둔 라우트는 기본 가드가 없으므로 requireRole의 fail-closed 동작만 따로 본다
  app.get('/api/_test/role-without-session', requireRole('OPERATOR'), (c) => c.json({ ok: true }));
  return built;
}

type Built = ReturnType<typeof buildAdminApp>;

/** 해당 역할의 사용자로 로그인한 세션 쿠키를 돌려준다. 역할은 DB에서 직접 지정한다(시드) */
async function loginWithRole(built: Built, role: Role, kakaoId = `k-${role}`) {
  const { cookie, userId } = await loginAs(built, { kakaoId });
  await env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, userId).run();
  return { cookie, userId };
}

const get = (built: Built, path: string, cookie?: string) =>
  built.app.request(`${ORIGIN}${path}`, cookie ? { headers: { Cookie: cookie } } : undefined);

describe('IA 역할별 관리 API 접근 차단 [S47][SPEC §16][T06]', () => {
  it('세션 없이 관리 API를 부르면 401이고 loginUrl이 담긴다', async () => {
    const built = buildAdminApp();

    const res = await get(built, '/api/admin/_test/operator');

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: '/auth/kakao/login?returnTo=%2Fapi%2Fadmin%2F_test%2Foperator',
    });
  });

  it('USER가 관리 API를 부르면 403 FORBIDDEN이다', async () => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, 'USER');

    const res = await get(built, '/api/admin/_test/operator', cookie);

    expect(res.status).toBe(403);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN', status: 403 });
  });

  it('USER는 아직 없는 관리 경로도 403이다 (존재 여부를 드러내지 않는다)', async () => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, 'USER');

    const res = await get(built, '/api/admin/not-built-yet', cookie);

    expect(res.status).toBe(403);
  });

  it.each(['OPERATOR', 'ADMIN'] as const)('%s는 운영자용 관리 API를 호출할 수 있다', async (role) => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, role);

    const res = await get(built, '/api/admin/_test/operator', cookie);

    expect(res.status).toBe(200);
  });

  it('OPERATOR가 ADMIN 전용 API를 부르면 403이다', async () => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, 'OPERATOR');

    const res = await get(built, '/api/admin/_test/admin-only', cookie);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('USER가 ADMIN 전용 API를 부르면 403이다', async () => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, 'USER');

    const res = await get(built, '/api/admin/_test/admin-only', cookie);

    expect(res.status).toBe(403);
  });

  it('ADMIN은 ADMIN 전용 API를 호출할 수 있다', async () => {
    const built = buildAdminApp();
    const { cookie } = await loginWithRole(built, 'ADMIN');

    const res = await get(built, '/api/admin/_test/admin-only', cookie);

    expect(res.status).toBe(200);
  });

  it('역할이 바뀌면 같은 세션이라도 다음 요청부터 바뀐 역할로 판단한다', async () => {
    const built = buildAdminApp();
    const { cookie, userId } = await loginWithRole(built, 'ADMIN');
    expect((await get(built, '/api/admin/_test/admin-only', cookie)).status).toBe(200);

    await env.DB.prepare("UPDATE users SET role = 'USER' WHERE id = ?").bind(userId).run();

    expect((await get(built, '/api/admin/_test/admin-only', cookie)).status).toBe(403);
  });

  it('세션 확인 없이 requireRole만 걸린 경로는 통과시키지 않는다 (fail-closed)', async () => {
    const built = buildAdminApp();

    const res = await get(built, '/api/_test/role-without-session');

    expect(res.status).toBe(403);
  });
});
