import { describe, expect, it } from 'vitest';
import { adminTabOf } from '../../src/web/admin/tabs';

describe('관리 콘솔 상단 탭 선택 [T61][T30]', () => {
  it.each([
    ['/admin', 'catalog'],
    ['/admin/', 'catalog'],
    ['/admin/catalog/new', 'catalog'],
    ['/admin/catalog/new-sponsored', 'catalog'],
    ['/admin/catalog/33c600ba-4a12-4e3f-9d80-16f8128dfbc4', 'catalog'],
    ['/admin/partners', 'partners'],
    ['/admin/reports', 'reports'],
  ] as const)('%s 는 %s 탭이다', (pathname, tab) => {
    expect(adminTabOf(pathname)).toBe(tab);
  });

  it('관리 콘솔 밖이거나 모르는 경로는 어느 탭도 아니다', () => {
    expect(adminTabOf('/trials')).toBeNull();
    expect(adminTabOf('/admin/unknown')).toBeNull();
    // 접두사만 같은 다른 경로를 같은 탭으로 보지 않는다
    expect(adminTabOf('/administrator')).toBeNull();
    expect(adminTabOf('/admin/partnersX')).toBeNull();
  });
});
