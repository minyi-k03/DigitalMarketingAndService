import type { MiddlewareHandler } from 'hono';
import type { AppDeps } from '../deps';

/** 요청 한 줄 로그. 쿼리 문자열에는 OAuth code 등이 있을 수 있어 경로만 남긴다 */
export const requestLog =
  ({ clock, logger }: Pick<AppDeps, 'clock' | 'logger'>): MiddlewareHandler =>
  async (c, next) => {
    const startedAt = clock.now().getTime();
    await next();
    logger.info('http_request', {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: clock.now().getTime() - startedAt,
    });
  };
