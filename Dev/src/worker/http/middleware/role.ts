import type { MiddlewareHandler } from 'hono';
import { hasRole, type UserRole } from '../../modules/identity';
import { DomainError } from '../../platform/errors';
import type { AppEnv } from '../app-env';

/**
 * 관리 API 역할 검사 (SPEC §16). `requireSession` 뒤에 둔다.
 * 'OPERATOR'는 OPERATOR와 ADMIN을, 'ADMIN'은 ADMIN만 통과시킨다.
 * 세션 정보가 없으면 통과시키지 않는다 (fail-closed).
 */
export const requireRole =
  (required: Exclude<UserRole, 'USER'>): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const user = c.get('user') as AppEnv['Variables']['user'] | undefined;
    if (!user || !hasRole(user.role, required)) throw new DomainError('FORBIDDEN');
    await next();
  };
