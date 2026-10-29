import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { IdentityService } from '../../modules/identity';
import { DomainError } from '../../platform/errors';
import type { AppEnv } from '../app-env';

export const SESSION_COOKIE = 'sc_session';

/** 401 UNAUTHENTICATED. 로그인 후 돌아올 경로(returnTo)가 담긴 loginUrl을 싣는다 (SPEC §15) */
export function unauthenticated(requestUrl: string): DomainError {
  const url = new URL(requestUrl);
  const returnTo = encodeURIComponent(url.pathname + url.search);
  return new DomainError('UNAUTHENTICATED', undefined, {
    loginUrl: `/auth/kakao/login?returnTo=${returnTo}`,
  });
}

/** 세션이 없으면 401과 returnTo가 담긴 loginUrl을 돌려준다 (SPEC §15) */
export const requireSession =
  (identity: IdentityService): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const user = await identity.authenticate(getCookie(c, SESSION_COOKIE));
    if (!user) throw unauthenticated(c.req.url);
    c.set('user', user);
    await next();
  };
