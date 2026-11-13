import type { components } from '../../shared/api-types';

type PublicView = components['schemas']['CatalogItemPublicView'];

export type ServiceCategory = PublicView['serviceCategory'];
export type CategoryFilter = ServiceCategory | 'ALL';

/** 목록 필터가 읽는 필드만 좁혀 둔다. 화면은 `CatalogItemPublicView` 전체를 넘긴다 */
export type CatalogListItem = Pick<
  PublicView,
  'id' | 'name' | 'serviceCategory' | 'publicationStatus'
>;

type FilterInput = { category: CategoryFilter; query: string };

/**
 * 입력창 값과 주소의 검색어를 맞춘다. 입력 중에는 입력값을 그대로 두고(IME 조합이 흔들리지 않게),
 * 홈 링크·뒤로가기로 주소의 검색어가 달라졌을 때만 주소를 따라간다.
 * 앞뒤 공백만 다른 경우는 같은 검색어로 본다(주소에 공백만 있는 검색어는 남기지 않기 때문).
 */
export function reconcileQuery(local: string, fromUrl: string): string {
  return local.trim() === fromUrl.trim() ? local : fromUrl;
}

/** 분야·서비스명 필터. 서버 순서를 지키되 게시 중단 항목은 뒤로 보낸다 (D-13: 숨기지 않는다) */
export function filterCatalog<T extends CatalogListItem>(
  items: readonly T[],
  { category, query }: FilterInput,
): T[] {
  const needle = query.trim().toLowerCase();
  const matched = items.filter(
    (item) =>
      (category === 'ALL' || item.serviceCategory === category) &&
      (needle === '' || item.name.toLowerCase().includes(needle)),
  );
  return [
    ...matched.filter((item) => item.publicationStatus === 'PUBLISHED'),
    ...matched.filter((item) => item.publicationStatus !== 'PUBLISHED'),
  ];
}
