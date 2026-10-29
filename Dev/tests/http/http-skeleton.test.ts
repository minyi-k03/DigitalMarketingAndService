import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createApp } from '../../src/worker/http/app';
import { redact, type Logger } from '../../src/worker/http/logger';
import { validateJson } from '../../src/worker/http/validate';
import { DomainError, type DomainErrorCode } from '../../src/worker/platform/errors';
import { createIdentityService } from '../../src/worker/modules/identity';
import { FakeClock } from '../support/fake-clock';
import { FakeKakaoOAuthClient } from '../support/fake-kakao-oauth';

type LogEntry = { level: 'info' | 'error'; event: string; fields: Record<string, unknown> };

function buildApp() {
  const logs: LogEntry[] = [];
  const logger: Logger = {
    info: (event, fields = {}) => logs.push({ level: 'info', event, fields }),
    error: (event, fields = {}) => logs.push({ level: 'error', event, fields }),
  };
  const clock = new FakeClock('2026-12-09T01:00:00.000Z');
  const identity = createIdentityService({
    db: env.DB,
    clock,
    kakao: new FakeKakaoOAuthClient(),
    sessionSigningKey: 'test-session-signing-key',
    tokenEncryptionKey: btoa('0123456789abcdef0123456789abcdef'),
  });
  const app = createApp({ clock, db: env.DB, logger, identity });

  app.post(
    '/api/_test/echo',
    validateJson(z.object({ name: z.string().min(1), days: z.number().int() })),
    (c) => c.json(c.req.valid('json')),
  );
  app.get('/api/_test/domain-error', (c) => {
    const code = c.req.query('code') as DomainErrorCode;
    if (code === 'DUPLICATE_ACTIVE_RECORD') {
      throw new DomainError(code, '이미 진행 중입니다', { existingTrialRecordId: 'trial-1' });
    }
    if (code === 'UNAUTHENTICATED') {
      throw new DomainError(code, undefined, { loginUrl: '/auth/kakao/login?returnTo=%2Ftrials' });
    }
    throw new DomainError(code);
  });
  app.get('/api/_test/boom', () => {
    throw new Error('db password is hunter2');
  });

  return { app, logs };
}

const ORIGIN = 'http://localhost';
const postJson = (path: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...headers },
    body,
  });

describe('HTTP 골격: zod 검증과 problem+json [D-06][T04]', () => {
  it('유효한 본문은 검증을 통과한다', async () => {
    const { app } = buildApp();

    const res = await app.request(postJson('/api/_test/echo', '{"name":"넷플릭스","days":30}'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: '넷플릭스', days: 30 });
  });

  it('잘못된 본문은 400 VALIDATION_FAILED problem+json과 필드별 errors를 돌려준다', async () => {
    const { app } = buildApp();

    const res = await app.request(postJson('/api/_test/echo', '{"name":"","days":"abc"}'));
    const body = (await res.json()) as {
      type: string;
      status: number;
      code: string;
      errors: { field: string; message: string }[];
    };

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(body).toMatchObject({
      type: 'https://subcut.app/problems/validation-failed',
      status: 400,
      code: 'VALIDATION_FAILED',
    });
    expect(body.errors.map((e) => e.field).sort()).toEqual(['days', 'name']);
  });

  it('JSON이 아닌 본문도 400 VALIDATION_FAILED다', async () => {
    const { app } = buildApp();

    const res = await app.request(postJson('/api/_test/echo', '{not json'));

    expect(res.status).toBe(400);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it.each([
    ['VALIDATION_FAILED', 400],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['INVALID_TRANSITION', 409],
    ['DUPLICATE_ACTIVE_RECORD', 409],
    ['CONFLICT', 409],
    ['EXIT_POLL_REQUIRED', 422],
    ['CATALOG_ITEM_NOT_PUBLISHED', 422],
    ['TRIAL_ALREADY_ENDED', 422],
    ['BRIDGE_NOT_AVAILABLE', 422],
    ['INTERNAL_ERROR', 500],
  ] satisfies [DomainErrorCode, number][])(
    'DomainError %s는 HTTP %i로 매핑된다',
    async (code, status) => {
      const { app } = buildApp();

      const res = await app.request(`${ORIGIN}/api/_test/domain-error?code=${code}`);

      expect(res.status).toBe(status);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expect(await res.json()).toMatchObject({ code, status });
    },
  );

  it('DomainError의 부가 필드(existingTrialRecordId, loginUrl)와 detail이 응답에 실린다', async () => {
    const { app } = buildApp();

    const duplicate = await app.request(
      `${ORIGIN}/api/_test/domain-error?code=DUPLICATE_ACTIVE_RECORD`,
    );
    const unauth = await app.request(`${ORIGIN}/api/_test/domain-error?code=UNAUTHENTICATED`);

    expect(await duplicate.json()).toMatchObject({
      detail: '이미 진행 중입니다',
      existingTrialRecordId: 'trial-1',
    });
    const unauthBody = (await unauth.json()) as Record<string, unknown>;
    expect(unauthBody.loginUrl).toBe('/auth/kakao/login?returnTo=%2Ftrials');
    expect(unauthBody).not.toHaveProperty('detail');
  });

  it('없는 /api 경로는 404 NOT_FOUND problem+json이다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/api/nope`);

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    expect(await res.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('예상하지 못한 오류는 내부 정보 없이 500 problem+json으로 답하고 로그를 남긴다', async () => {
    const { app, logs } = buildApp();

    const res = await app.request(`${ORIGIN}/api/_test/boom`);
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');
    // 계약: 모든 problem은 code를 가진다 (Problem.required에 code 포함)
    expect(JSON.parse(text)).toMatchObject({
      type: 'https://subcut.app/problems/internal-error',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(text).not.toContain('hunter2');
    expect(logs.some((l) => l.level === 'error' && l.event === 'unhandled_error')).toBe(true);
  });

  // 오류 메시지에는 쿼리 값·토큰 등이 섞일 수 있고, redact는 키 이름만 걸러 메시지 안의 값은 못 가린다
  it('예상하지 못한 오류 로그에는 오류 메시지를 남기지 않고 종류만 남긴다 [SPEC §15]', async () => {
    const { app, logs } = buildApp();

    await app.request(`${ORIGIN}/api/_test/boom`);

    const entry = logs.find((l) => l.event === 'unhandled_error');
    expect(entry?.fields).toMatchObject({ name: 'Error' });
    expect(JSON.stringify(logs)).not.toContain('hunter2');
  });
});

describe('HTTP 골격: Origin 확인 [SPEC §15][T04]', () => {
  it('상태 변경 요청에 Origin이 없으면 403 FORBIDDEN이다', async () => {
    const { app } = buildApp();
    const req = new Request(`${ORIGIN}/api/_test/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name":"a","days":1}',
    });

    const res = await app.request(req);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('다른 도메인의 Origin은 403 FORBIDDEN이다', async () => {
    const { app } = buildApp();

    const res = await app.request(
      postJson('/api/_test/echo', '{"name":"a","days":1}', { Origin: 'https://evil.example' }),
    );

    expect(res.status).toBe(403);
  });

  it('/auth 경로의 상태 변경 요청에도 적용된다', async () => {
    const { app } = buildApp();

    const res = await app.request(
      new Request(`${ORIGIN}/auth/logout`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      }),
    );

    expect(res.status).toBe(403);
  });

  it('GET 요청은 Origin 없이도 허용한다', async () => {
    const { app } = buildApp();

    const res = await app.request(`${ORIGIN}/api/health`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});

describe('HTTP 골격: PII 마스킹 로거 [SPEC §15][T04]', () => {
  it('phone·kakaoId·token·cookie 계열 키는 값을 지운다', () => {
    const masked = redact({
      phoneNumber: '010-1234-5678',
      kakaoId: '12345',
      accessToken: 'abc',
      refresh_token: 'def',
      cookie: 'sc_session=zzz',
      headers: { Authorization: 'Bearer x', accept: 'json' },
      list: [{ sessionToken: 't' }],
      path: '/api/health',
    });

    expect(masked).toEqual({
      phoneNumber: '[REDACTED]',
      kakaoId: '[REDACTED]',
      accessToken: '[REDACTED]',
      refresh_token: '[REDACTED]',
      cookie: '[REDACTED]',
      headers: { Authorization: '[REDACTED]', accept: 'json' },
      list: [{ sessionToken: '[REDACTED]' }],
      path: '/api/health',
    });
  });

  it('요청 로그에는 경로만 남기고 쿼리 문자열(OAuth code 등)은 남기지 않는다', async () => {
    const { app, logs } = buildApp();

    await app.request(`${ORIGIN}/api/health?code=secret-oauth-code&state=abc`);

    const entry = logs.find((l) => l.event === 'http_request');
    expect(entry?.fields).toMatchObject({ method: 'GET', path: '/api/health', status: 200 });
    expect(JSON.stringify(logs)).not.toContain('secret-oauth-code');
  });
});
