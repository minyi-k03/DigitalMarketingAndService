import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { buildLoginApp, loginAs, ORIGIN } from '../support/http-login';

type Me = components['schemas']['Me'];
type Problem = components['schemas']['Problem'];
type Built = ReturnType<typeof buildLoginApp>;

const PATH = '/api/me/notification-settings';

function put(built: Built, body: unknown, headers: Record<string, string> = {}) {
  return built.app.request(`${ORIGIN}${PATH}`, {
    method: 'PUT',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const getMe = (built: Built, cookie: string) =>
  built.app.request(`${ORIGIN}/api/me`, { headers: { Cookie: cookie } });

describe('IA 알림 수신 설정 API [S44][T07]', () => {
  it('로그인 없이 호출하면 401 UNAUTHENTICATED와 loginUrl이다', async () => {
    const built = buildLoginApp();

    const res = await put(built, { notificationEnabled: false });

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      code: 'UNAUTHENTICATED',
      loginUrl: expect.stringContaining('/auth/kakao/login'),
    });
  });

  it('끄면 200과 갱신된 내 정보를 돌려주고 이후 /api/me에도 반영된다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    const res = await put(built, { notificationEnabled: false }, { Cookie: cookie });
    const after = (await (await getMe(built, cookie)).json()) as Me;

    expect(res.status).toBe(200);
    expect(((await res.json()) as Me).notificationEnabled).toBe(false);
    expect(after.notificationEnabled).toBe(false);
  });

  it('다시 켜면 true로 돌아온다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
    await put(built, { notificationEnabled: false }, { Cookie: cookie });

    const res = await put(built, { notificationEnabled: true }, { Cookie: cookie });

    expect(((await res.json()) as Me).notificationEnabled).toBe(true);
  });

  it('잘못된 본문은 400 VALIDATION_FAILED이고 설정은 바뀌지 않는다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });
    const bodies: unknown[] = [
      {},
      { notificationEnabled: 'false' },
      { notificationEnabled: false, role: 'ADMIN' },
      '{not json',
    ];

    for (const body of bodies) {
      const res = await put(built, body, { Cookie: cookie });

      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
    }
    expect(((await (await getMe(built, cookie)).json()) as Me).notificationEnabled).toBe(true);
  });

  it('다른 Origin에서 온 요청은 403이고 설정은 바뀌지 않는다', async () => {
    const built = buildLoginApp();
    const { cookie } = await loginAs(built, { kakaoId: `k-${crypto.randomUUID()}` });

    const res = await put(
      built,
      { notificationEnabled: false },
      { Cookie: cookie, Origin: 'https://evil.example.com' },
    );

    expect(res.status).toBe(403);
    expect(((await (await getMe(built, cookie)).json()) as Me).notificationEnabled).toBe(true);
  });
});
