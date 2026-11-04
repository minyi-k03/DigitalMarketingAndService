import type { Clock } from '../../platform/clock';

export interface CatalogDeps {
  db: D1Database;
  clock: Clock;
}

/** 변경 이력의 `changedBy`로 남길 운영자. 세션 사용자(`AuthenticatedUser`)가 구조적으로 맞는다 */
export interface CatalogActor {
  userId: string;
}
