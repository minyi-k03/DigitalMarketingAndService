import type { MiddlewareHandler } from 'hono';
import { DomainError } from '../../platform/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** 상태를 바꾸는 요청은 Origin이 자기 도메인일 때만 허용한다 (CSRF, architecture §9) */
export const checkOrigin = (): MiddlewareHandler => async (c, next) => {
  if (!SAFE_METHODS.has(c.req.method)) {
    const origin = c.req.header('Origin');
    if (origin !== new URL(c.req.url).origin) {
      throw new DomainError('FORBIDDEN', '허용되지 않은 Origin입니다');
    }
  }
  await next();
};
