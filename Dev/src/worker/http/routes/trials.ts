import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { requireSession } from '../middleware/session';
import { validateJson } from '../validate';

// api/openapi.yaml의 CreateTrialRecordRequest. userId는 본문에서 받지 않으므로 알 수 없는 필드로 거부한다.
// 날짜의 실제 존재 여부와 오늘 이후 여부는 도메인이 검증한다 (SPEC §3).
const createTrialBody = z.strictObject({
  catalogItemId: z.string().min(1),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다')
    .optional(),
  trialDays: z.number().int().min(1).max(365).optional(),
  // 발표 범위(P0)에서는 이 값만 허용한다. SPONSORED_OUTBOUND_PROMPT는 P1(T43)
  source: z.literal('MANUAL_CATALOG_SELECT').optional(),
});

export const trialRoutes = ({
  identity,
  trialTracking,
}: Pick<AppDeps, 'identity' | 'trialTracking'>) =>
  new Hono<AppEnv>().post(
    '/api/trials',
    requireSession(identity),
    validateJson(createTrialBody),
    async (c) =>
      c.json(
        await trialTracking.createTrialRecord({
          userId: c.get('user').userId,
          ...c.req.valid('json'),
        }),
        201,
      ),
  );
