import { Hono } from 'hono';
import { z } from 'zod';
import type { components } from '../../../shared/api-types';
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

const EXIT_REASONS = [
  'PRICE_BURDEN',
  'LACK_OF_FEATURES',
  'COMPLEX_UX',
  'SHORT_TERM_GOAL_MET',
  'MOVED_TO_ALTERNATIVE',
] as const satisfies readonly components['schemas']['ExitReason'][];

// 본문은 선택이다. 본문 없이 보내면(Content-Type 없음) 빈 객체로 검증한다
const confirmCancelBody = z.strictObject({ exitReason: z.enum(EXIT_REASONS).optional() });

const billingResolutionBody = z.strictObject({
  resolution: z.enum(['BILLED', 'CANCELED_BEFORE_BILLING', 'KEEP_USING']),
  exitReason: z.enum(EXIT_REASONS).optional(),
});

export const trialRoutes = ({
  identity,
  trialTracking,
}: Pick<AppDeps, 'identity' | 'trialTracking'>) =>
  new Hono<AppEnv>()
    .post('/api/trials', requireSession(identity), validateJson(createTrialBody), async (c) =>
      c.json(
        await trialTracking.createTrialRecord({
          userId: c.get('user').userId,
          ...c.req.valid('json'),
        }),
        201,
      ),
    )
    // 상태 전이 (SPEC §5). 소유 확인은 명령이 userId로 하며 남의 기록은 404다
    .post(
      '/api/trials/:trialRecordId/confirm-cancel',
      requireSession(identity),
      validateJson(confirmCancelBody),
      async (c) =>
        c.json(
          await trialTracking.confirmCancel({
            userId: c.get('user').userId,
            trialRecordId: c.req.param('trialRecordId'),
            ...c.req.valid('json'),
          }),
        ),
    )
    .post('/api/trials/:trialRecordId/keep', requireSession(identity), async (c) =>
      c.json(
        await trialTracking.decideKeep({
          userId: c.get('user').userId,
          trialRecordId: c.req.param('trialRecordId'),
        }),
      ),
    )
    .post('/api/trials/:trialRecordId/void', requireSession(identity), async (c) =>
      c.json(
        await trialTracking.voidTrialRecord({
          userId: c.get('user').userId,
          trialRecordId: c.req.param('trialRecordId'),
        }),
      ),
    )
    .post(
      '/api/trials/:trialRecordId/billing-resolution',
      requireSession(identity),
      validateJson(billingResolutionBody),
      async (c) =>
        c.json(
          await trialTracking.resolveMissedBilling({
            userId: c.get('user').userId,
            trialRecordId: c.req.param('trialRecordId'),
            ...c.req.valid('json'),
          }),
        ),
    );
