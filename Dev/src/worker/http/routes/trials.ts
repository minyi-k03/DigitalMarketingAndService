import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { components } from '../../../shared/api-types';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { requireSession } from '../middleware/session';
import { validateJson } from '../validate';

// api/openapi.yaml의 CreateTrialRecordRequest. userId는 본문에서 받지 않으므로 알 수 없는 필드로 거부한다.
// 날짜의 실제 존재 여부와 오늘 이후 여부는 도메인이 검증한다 (SPEC §3).
const startDateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식이어야 합니다');
const trialDaysField = z.number().int().min(1).max(365);

const createTrialBody = z.strictObject({
  catalogItemId: z.string().min(1),
  startDate: startDateField.optional(),
  trialDays: trialDaysField.optional(),
  // 발표 범위(P0)에서는 이 값만 허용한다. SPONSORED_OUTBOUND_PROMPT는 P1(T43)
  source: z.literal('MANUAL_CATALOG_SELECT').optional(),
});

// api/openapi.yaml의 UpdateTrialRecordRequest. `catalogItemId`·`source`는 수정할 수 없으므로 알 수 없는 필드로 거부한다 (SPEC §5)
const updateTrialBody = z
  .strictObject({ startDate: startDateField.optional(), trialDays: trialDaysField.optional() })
  .refine((body) => Object.keys(body).length > 0, '수정할 필드를 하나 이상 보내야 합니다');

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
  logger,
}: Pick<AppDeps, 'identity' | 'trialTracking' | 'logger'>) => {
  /**
   * 응답을 보낸 뒤 그 기록의 도래한 알림을 바로 보낸다 (architecture §5.6). 등록·수정으로 정규 슬롯이 모두
   * 지나면 `LATE_REGISTRATION`(`sendAt = now`)이 저장되는데, 다음 Cron(최대 10분 뒤)을 기다리면 늦은 등록의 의미가
   * 없다. 보낼 것이 없어도 복구·만료·선점 UPDATE 3문장은 실행하지만 바뀌는 행은 없다. 실패해도 응답은 그대로이고 다음 Cron이 다시 집어 간다.
   * ExecutionContext가 없는 실행(ctx 없이 `app.request`를 부르는 단위 테스트)에서는 건너뛴다. 배포 환경은 항상 있다.
   */
  const dispatchAfterResponse = (c: Context<AppEnv>, trialRecordId: string) => {
    let waitUntil: ExecutionContext['waitUntil'];
    try {
      waitUntil = c.executionCtx.waitUntil.bind(c.executionCtx);
    } catch {
      return;
    }
    waitUntil(
      trialTracking.dispatchDueNotifications({ trialRecordId }).catch((e: unknown) => {
        // 오류 메시지에는 수신처 정보가 섞일 수 있어 종류만 남긴다 (SPEC §15)
        logger.error('notification_dispatch_failed', {
          name: e instanceof Error ? e.name : 'unknown',
        });
      }),
    );
  };

  return (
    new Hono<AppEnv>()
      .post('/api/trials', requireSession(identity), validateJson(createTrialBody), async (c) => {
        const record = await trialTracking.createTrialRecord({
          userId: c.get('user').userId,
          ...c.req.valid('json'),
        });
        dispatchAfterResponse(c, record.id);
        return c.json(record, 201);
      })
      // 기록 수정 (SPEC §5 수정 범위, §6 재예약)
      .patch(
        '/api/trials/:trialRecordId',
        requireSession(identity),
        validateJson(updateTrialBody),
        async (c) => {
          const record = await trialTracking.updateTrialRecord({
            userId: c.get('user').userId,
            trialRecordId: c.req.param('trialRecordId'),
            ...c.req.valid('json'),
          });
          dispatchAfterResponse(c, record.id);
          return c.json(record);
        },
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
      )
  );
};
