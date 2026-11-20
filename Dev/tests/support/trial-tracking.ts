import { env } from 'cloudflare:test';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { createTrialTrackingService } from '../../src/worker/modules/trial-tracking';
import { seedItem } from './catalog-seed';
import type { CatalogItemInput } from './catalog-fixtures';
import { FakeClock } from './fake-clock';
import { insertUser } from './user-seed';

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

/** 새 사용자가 게시된 항목을 `startAt` 시각에 오늘 시작으로 등록한 상태 */
export async function registerTrial(
  startAt: string,
  itemOverrides: Partial<CatalogItemInput> = {},
) {
  const ctx = buildTrialTracking(startAt);
  const item = await seedItem(ctx.catalog, 'PUBLISHED', itemOverrides);
  const userId = await insertUser();
  const record = await ctx.trialTracking.createTrialRecord({ userId, catalogItemId: item.id });
  return { ...ctx, item, userId, record, ref: { userId, trialRecordId: record.id } };
}
