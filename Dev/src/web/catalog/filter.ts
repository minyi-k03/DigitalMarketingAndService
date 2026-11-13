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
