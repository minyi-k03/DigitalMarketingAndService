import { env } from 'cloudflare:test';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { FakeClock } from './fake-clock';

/** 실제 D1과 실제 카탈로그 서비스로 조립한 Trial Tracking. 시계만 FakeClock이다 */
export function buildTrialTracking(startAt: string) {
  const clock = new FakeClock(startAt);
  const catalog = createCatalogService({ db: env.DB, clock });
  let interleave: (() => Promise<unknown>) | undefined;
  // 동시 요청 재현용: 명령이 기록을 읽은 뒤 저장하기 전에 카탈로그 조건을 읽는 순간, 한 번만 다른 명령을 먼저 끝낸다.
  // 카탈로그 자체는 실제 서비스 그대로다
  const trialTracking = createTrialTrackingService({
    db: env.DB,
    clock,
    catalog: {
      getEscapeContent: (id) => catalog.getEscapeContent(id),
      getTrackingTerms: async (id) => {
        const run = interleave;
        interleave = undefined;
        if (run) await run().catch(() => undefined);
        return catalog.getTrackingTerms(id);
      },
    },
  });
  const interleaveOnce = (run: () => Promise<unknown>) => {
    interleave = run;
  };
  return { clock, catalog, trialTracking, interleaveOnce };
}
