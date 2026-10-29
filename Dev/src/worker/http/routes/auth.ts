import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { DomainError } from '../../platform/errors';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { SESSION_COOKIE } from '../middleware/session';
import { validateQuery } from '../validate';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// 로그인 CSRF 방어: 로그인을 시작한 브라우저에만 nonce를 심고, 콜백에서 state 안의 nonce와 대조한다.
// state와 같은 10분 동안만 유효하며 로그인 경로 밖으로는 전송하지 않는다.
const LOGIN_NONCE_COOKIE = 'sc_login_nonce';
const LOGIN_NONCE_MAX_AGE_SECONDS = 10 * 60;
const LOGIN_NONCE_COOKIE_OPTIONS = { path: '/auth/kakao', secure: true } as const;

const callbackUri = (requestUrl: string) => new URL('/auth/kakao/callback', requestUrl).toString();

export const authRoutes = ({ identity }: Pick<AppDeps, 'identity'>) =>
  new Hono<AppEnv>()
    .get(
      '/auth/kakao/login',
      validateQuery(z.object({ returnTo: z.string().optional() })),
      async (c) => {
        const { returnTo } = c.req.valid('query');
        const { authorizeUrl, nonce } = await identity.startKakaoLogin({
          returnTo,
          redirectUri: callbackUri(c.req.url),
        });
        setCookie(c, LOGIN_NONCE_COOKIE, nonce, {
          ...LOGIN_NONCE_COOKIE_OPTIONS,
          httpOnly: true,
          sameSite: 'Lax',
          maxAge: LOGIN_NONCE_MAX_AGE_SECONDS,
        });
        return c.redirect(authorizeUrl, 302);
      },
    )
    .get(
      '/auth/kakao/callback',
      validateQuery(
        z.object({
          code: z.string().optional(),
          state: z.string().optional(),
          error: z.string().optional(),
        }),
      ),
      async (c) => {
        const { code, state, error } = c.req.valid('query');

        // 사용자가 동의 화면에서 취소하거나 카카오가 오류를 돌려준 경우: 내부 경로로 돌려보낸다.
        // error 값은 화이트리스트만 반사한다 (입력을 그대로 URL에 싣지 않는다).
        if (error) {
          deleteCookie(c, LOGIN_NONCE_COOKIE, LOGIN_NONCE_COOKIE_OPTIONS);
          const reason = error === 'access_denied' ? 'access_denied' : 'failed';
          return c.redirect(`/?loginError=${reason}`, 302);
        }

        if (!code || !state) {
          throw new DomainError('VALIDATION_FAILED', '쿼리 문자열이 올바르지 않습니다', {
            errors: [
              ...(code ? [] : [{ field: 'code', message: 'code가 필요합니다' }]),
              ...(state ? [] : [{ field: 'state', message: 'state가 필요합니다' }]),
            ],
          });
        }

        const { sessionToken, returnTo } = await identity.loginWithKakao({
          code,
          state,
          nonce: getCookie(c, LOGIN_NONCE_COOKIE),
          redirectUri: callbackUri(c.req.url),
        });
        deleteCookie(c, LOGIN_NONCE_COOKIE, LOGIN_NONCE_COOKIE_OPTIONS);
        setCookie(c, SESSION_COOKIE, sessionToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
          path: '/',
          maxAge: SESSION_MAX_AGE_SECONDS,
        });
        return c.redirect(returnTo, 302);
      },
    )
    .post('/auth/logout', async (c) => {
      await identity.logout(getCookie(c, SESSION_COOKIE));
      deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
      return c.body(null, 204);
    });
