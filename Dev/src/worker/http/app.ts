import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { DomainError } from '../platform/errors';
import type { AppEnv } from './app-env';
import type { AppDeps } from './deps';
import { checkOrigin } from './middleware/origin';
import { requestLog } from './middleware/request-log';
import { requireRole } from './middleware/role';
import { requireSession } from './middleware/session';
import { INTERNAL_ERROR_PROBLEM, PROBLEM_CONTENT_TYPE, toProblem } from './problem';
import { authRoutes } from './routes/auth';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';

function problemResponse(c: Context, body: { status: number }) {
  return c.body(JSON.stringify(body), body.status as ContentfulStatusCode, {
    'Content-Type': PROBLEM_CONTENT_TYPE,
  });
}

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();

  app.use('*', requestLog(deps));
  app.use('/api/*', checkOrigin());
  app.use('/auth/*', checkOrigin());
  // 관리 API는 기본으로 OPERATOR 이상만 통과시킨다. 이후 추가되는 관리 라우트도 가드를 빠뜨릴 수 없고,
  // ADMIN 전용 라우트는 라우트에서 requireRole('ADMIN')을 더 건다 (SPEC §16, AGENTS §6).
  app.use('/api/admin/*', requireSession(deps.identity), requireRole('OPERATOR'));

  app.route('/', healthRoutes());
  app.route('/', authRoutes(deps));
  app.route('/', meRoutes(deps));

  app.notFound((c) => problemResponse(c, toProblem(new DomainError('NOT_FOUND'))));

  app.onError((err, c) => {
    if (err instanceof DomainError) return problemResponse(c, toProblem(err));
    // Hono 검증기가 잘못된 JSON 본문에 던지는 400
    if (err instanceof HTTPException && err.status === 400) {
      return problemResponse(
        c,
        toProblem(
          new DomainError('VALIDATION_FAILED', '요청 본문이 올바른 JSON이 아닙니다', {
            errors: [{ field: 'body', message: err.message }],
          }),
        ),
      );
    }
    // 메시지에는 쿼리 값·토큰 등이 섞일 수 있고 redact는 키 이름만 걸러내므로 종류만 남긴다 (SPEC §15)
    deps.logger.error('unhandled_error', { name: err.name });
    return problemResponse(c, INTERNAL_ERROR_PROBLEM);
  });

  return app;
}
