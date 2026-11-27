import { describe, expect, it } from 'vitest';
import { adminAccess } from '../../src/web/admin/access';

describe('관리 콘솔 접근 판정 [T30][S38~S40]', () => {
  it('내 정보를 아직 불러오는 중이면 판정을 미룬다', () => {
    expect(adminAccess(undefined)).toBe('LOADING');
  });

  it('로그인하지 않았으면 로그인으로 보낸다', () => {
    expect(adminAccess(null)).toBe('LOGIN');
  });

  it('일반 회원은 막는다 (서버도 /api/admin*를 403으로 거부한다)', () => {
    expect(adminAccess({ role: 'USER' })).toBe('FORBIDDEN');
  });

  it('운영자와 관리자는 들어간다', () => {
    expect(adminAccess({ role: 'OPERATOR' })).toBe('OK');
    expect(adminAccess({ role: 'ADMIN' })).toBe('OK');
  });
});
