import type { components } from '../../../../shared/api-types';

export type UserRole = components['schemas']['UserRole'];

// SPEC §16: OPERATOR는 USER 권한 위, ADMIN은 OPERATOR 권한에 더해진다
const RANK: Record<UserRole, number> = { USER: 0, OPERATOR: 1, ADMIN: 2 };

/** actual 역할이 required 역할 이상인가 (ADMIN은 OPERATOR 권한을 포함한다) */
export function hasRole(actual: UserRole, required: UserRole): boolean {
  return RANK[actual] >= RANK[required];
}
