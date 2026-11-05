import { describe, expect, it } from 'vitest';
import { readApiResponse } from '../../src/web/api/response';

const problemResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

describe('SPA API 클라이언트 응답 해석 [T25]', () => {
  it('성공한 JSON 응답은 본문을 데이터로 돌려준다', async () => {
    const res = Response.json({ id: 'u1', role: 'USER', notificationEnabled: true });

    const result = await readApiResponse(res, '/');

    expect(result).toEqual({
      ok: true,
      data: { id: 'u1', role: 'USER', notificationEnabled: true },
    });
  });

  it('본문이 없는 204 응답은 데이터 없이 성공으로 읽는다', async () => {
    const res = new Response(null, { status: 204 });

    const result = await readApiResponse(res, '/');

    expect(result).toEqual({ ok: true, data: undefined });
  });

  it('401 UNAUTHENTICATED는 현재 화면으로 돌아오는 로그인 이동 주소를 함께 돌려준다 [S16]', async () => {
    const res = problemResponse(401, {
      type: 'https://subcut.app/problems/unauthenticated',
      title: 'Unauthorized',
      status: 401,
      code: 'UNAUTHENTICATED',
      loginUrl: '/auth/kakao/login?returnTo=%2Fapi%2Ftrials',
    });

    const result = await readApiResponse(res, '/trials?tab=ACTIVE');

    expect(result).toMatchObject({
      ok: false,
      error: { status: 401, code: 'UNAUTHENTICATED' },
      loginRedirect: '/auth/kakao/login?returnTo=%2Ftrials%3Ftab%3DACTIVE',
    });
  });

  it('problem+json이 아닌 실패 응답(HTML 502 등)은 INTERNAL_ERROR로 읽고 파싱 오류를 던지지 않는다', async () => {
    const res = new Response('<html>Bad Gateway</html>', {
      status: 502,
      headers: { 'Content-Type': 'text/html' },
    });

    const result = await readApiResponse(res, '/');

    expect(result).toMatchObject({
      ok: false,
      error: { status: 502, code: 'INTERNAL_ERROR' },
    });
  });

  it('problem+json 오류는 code와 부가 필드를 가진 오류로 읽는다 [S8]', async () => {
    const res = problemResponse(409, {
      type: 'https://subcut.app/problems/duplicate-active-record',
      title: 'Conflict',
      status: 409,
      code: 'DUPLICATE_ACTIVE_RECORD',
      detail: '이미 진행 중인 기록이 있습니다',
      existingTrialRecordId: 'trial-1',
    });

    const result = await readApiResponse(res, '/catalog/netflix');

    expect(result).toEqual({
      ok: false,
      error: {
        status: 409,
        code: 'DUPLICATE_ACTIVE_RECORD',
        title: 'Conflict',
        detail: '이미 진행 중인 기록이 있습니다',
        existingTrialRecordId: 'trial-1',
      },
    });
  });
});
