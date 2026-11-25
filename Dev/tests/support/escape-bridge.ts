import { createEscapeBridgeService } from '../../src/worker/modules/escape-bridge';
import type { CatalogItemInput } from './catalog-fixtures';
import { registerTrial } from './trial-tracking';

/** `registerTrial`에 실제 Trial Tracking·카탈로그로 조립한 EscapeBridge를 더한다 */
export async function registerBridgeTrial(
  startAt: string,
  itemOverrides: Partial<CatalogItemInput> = {},
) {
  const ctx = await registerTrial(startAt, itemOverrides);
  const escapeBridge = createEscapeBridgeService({
    trialTracking: ctx.trialTracking,
    catalog: ctx.catalog,
  });
  return { ...ctx, escapeBridge };
}
