import { env } from 'cloudflare:test';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { FakeClock } from './fake-clock';

/** 실제 D1과 실제 카탈로그 서비스로 조립한 Trial Tracking. 시계만 FakeClock이다 */
export function buildTrialTracking(startAt: string) {
  const clock = new FakeClock(startAt);
  const catalog = createCatalogService({ db: env.DB, clock });
  const trialTracking = createTrialTrackingService({ db: env.DB, clock, catalog });
  return { clock, catalog, trialTracking };
}
