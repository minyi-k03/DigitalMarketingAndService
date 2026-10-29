import {
  loginWithKakao,
  startKakaoLogin,
  type LoginWithKakaoInput,
  type StartKakaoLoginInput,
} from './application/login';
import { getKakaoMessageAccessToken } from './application/kakao-token';
import { getMe } from './application/me';
import { authenticate, logout } from './application/session';
import type { IdentityDeps } from './deps';

export type { IdentityDeps } from './deps';
export type { AuthenticatedUser } from './application/session';
export { hasRole, type UserRole } from './domain/role-policy';

/** Identity & Account 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createIdentityService(deps: IdentityDeps) {
  return {
    startKakaoLogin: (input: StartKakaoLoginInput) => startKakaoLogin(deps, input),
    loginWithKakao: (input: LoginWithKakaoInput) => loginWithKakao(deps, input),
    authenticate: (sessionToken: string | undefined) => authenticate(deps, sessionToken),
    logout: (sessionToken: string | undefined) => logout(deps, sessionToken),
    getMe: (userId: string) => getMe(deps, userId),
    getKakaoMessageAccessToken: (userId: string) => getKakaoMessageAccessToken(deps, userId),
  };
}

export type IdentityService = ReturnType<typeof createIdentityService>;
