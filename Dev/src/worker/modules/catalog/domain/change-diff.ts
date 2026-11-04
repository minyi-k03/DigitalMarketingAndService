import type { components } from '../../../../shared/api-types';

type CatalogItem = components['schemas']['CatalogItem'];
export type CatalogChange = components['schemas']['CatalogChangeLog']['changes'][number];

/** 객체 키 순서가 달라도 같은 값으로 비교하려고 키를 정렬해 직렬화한다 */
function stable(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/**
 * 수정 전후 항목에서 값이 달라진 필드만 이전 값·새 값으로 돌려준다 (SPEC §16 변경 이력).
 * 이전에 없던 필드는 `before`를 생략한다.
 */
export function diffCatalogItems(before: CatalogItem, after: CatalogItem): CatalogChange[] {
  const b = before as unknown as Record<string, unknown>;
  const a = after as unknown as Record<string, unknown>;
  const fields = new Set([...Object.keys(b), ...Object.keys(a)]);
  fields.delete('id');

  const changes: CatalogChange[] = [];
  for (const field of fields) {
    if (stable(b[field]) === stable(a[field])) continue;
    changes.push({
      field,
      ...(b[field] !== undefined && { before: b[field] }),
      ...(a[field] !== undefined && { after: a[field] }),
    });
  }
  return changes;
}
