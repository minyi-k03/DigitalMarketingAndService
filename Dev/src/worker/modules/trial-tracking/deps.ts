import type { Clock } from '../../platform/clock';
import type { CatalogService } from '../catalog';

export interface TrialTrackingDeps {
  db: D1Database;
  clock: Clock;
  /** 카탈로그는 공개 조회로만 읽는다 (architecture §3) */
  catalog: Pick<CatalogService, 'getTrackingTerms'>;
}
