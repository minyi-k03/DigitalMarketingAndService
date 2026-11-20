export type TrialsTab = 'ACTIVE' | 'PAST';

/** 주소의 `?tab=past`를 탭으로 읽는다. 없거나 알 수 없는 값은 진행 중 탭이다 */
export function parseTab(search: string): TrialsTab {
  return new URLSearchParams(search).get('tab') === 'past' ? 'PAST' : 'ACTIVE';
}

/** 탭을 주소 쿼리로 쓴다. 기본 탭(진행 중)은 쿼리를 붙이지 않는다 */
export function tabSearch(tab: TrialsTab): string {
  return tab === 'PAST' ? '?tab=past' : '';
}
