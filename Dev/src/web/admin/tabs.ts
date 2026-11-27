export type AdminTab = 'catalog' | 'partners' | 'reports';

/**
 * 현재 경로가 관리 콘솔 상단 탭 중 어느 쪽에 속하는지 정한다.
 * 서비스 탭은 목록(`/admin`)뿐 아니라 등록·수정(`/admin/catalog/...`)까지 포함한다.
 * 경로 한 칸 전체가 같아야 하므로 접두사만 같은 다른 경로는 어느 탭도 아니다.
 */
export function adminTabOf(pathname: string): AdminTab | null {
  const segments = pathname.split('/').filter((s) => s !== '');
  if (segments[0] !== 'admin') return null;
  const section = segments[1];
  if (section === undefined || section === 'catalog') return 'catalog';
  if (section === 'partners' || section === 'reports') return section;
  return null;
}
