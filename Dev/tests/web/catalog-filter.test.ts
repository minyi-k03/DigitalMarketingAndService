import { describe, expect, it } from 'vitest';
import { filterCatalog, type CatalogListItem } from '../../src/web/catalog/filter';

function item(
  id: string,
  name: string,
  serviceCategory: CatalogListItem['serviceCategory'],
  publicationStatus: CatalogListItem['publicationStatus'] = 'PUBLISHED',
): CatalogListItem {
  return { id, name, serviceCategory, publicationStatus };
}

const items = [
  item('a', 'Adobe Creative Cloud', 'CLOUD'),
  item('b', '유튜브 프리미엄', 'OTT', 'UNPUBLISHED'),
  item('c', 'Google AI Plus', 'AI'),
  item('d', '네이버플러스 멤버십', 'BIGTECH'),
  item('e', 'Dropbox Plus', 'CLOUD'),
];

describe('카탈로그 목록 필터 [T26][S1][S2]', () => {
  it('조건이 없으면 모든 항목을 보여 주되 게시 중단 항목은 뒤로 보낸다', () => {
    const result = filterCatalog(items, { category: 'ALL', query: '' });

    expect(result.map((i) => i.id)).toEqual(['a', 'c', 'd', 'e', 'b']);
  });

  it('분야를 고르면 그 분야 항목만 남기고 서버가 준 순서를 지킨다', () => {
    const result = filterCatalog(items, { category: 'CLOUD', query: '' });

    expect(result.map((i) => i.id)).toEqual(['a', 'e']);
  });

  it('서비스명 검색은 대소문자와 앞뒤 공백을 무시한다', () => {
    const result = filterCatalog(items, { category: 'ALL', query: '  plus ' });

    expect(result.map((i) => i.id)).toEqual(['c', 'e']);
  });

  it('한글 서비스명도 부분 일치로 찾는다', () => {
    const result = filterCatalog(items, { category: 'ALL', query: '네이버' });

    expect(result.map((i) => i.id)).toEqual(['d']);
  });

  it('게시 중단 항목도 검색 결과에 나온다 (D-13: 목록에서 숨기지 않는다)', () => {
    const result = filterCatalog(items, { category: 'ALL', query: '유튜브' });

    expect(result.map((i) => i.id)).toEqual(['b']);
  });

  it('분야와 검색어를 함께 적용한다', () => {
    const result = filterCatalog(items, { category: 'CLOUD', query: 'drop' });

    expect(result.map((i) => i.id)).toEqual(['e']);
  });

  it('맞는 항목이 없으면 빈 목록이다', () => {
    const result = filterCatalog(items, { category: 'DELIVERY', query: '' });

    expect(result).toEqual([]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const before = items.map((i) => i.id);

    filterCatalog(items, { category: 'ALL', query: '' });

    expect(items.map((i) => i.id)).toEqual(before);
  });
});
