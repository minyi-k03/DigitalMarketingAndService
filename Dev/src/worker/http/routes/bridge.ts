import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { exitReasonField } from '../exit-reason';
import { requireSession } from '../middleware/session';
import { validateJson } from '../validate';

// api/openapi.yaml POST /api/trials/{id}/cancel-attempts. 사유는 필수이고 알 수 없는 필드는 거부한다
const cancelAttemptBody = z.strictObject({ exitReason: exitReasonField });

export const bridgeRoutes = ({
  identity,
  escapeBridge,
}: Pick<AppDeps, 'identity' | 'escapeBridge'>) =>
  new Hono<AppEnv>()
    // 해지 브릿지 화면 데이터 (SPEC §7, D-09). 본인 기록만 읽고 남의 기록은 404, 종료된 기록은 422다
    .get('/api/trials/:trialRecordId/bridge', requireSession(identity), async (c) =>
      c.json(
        await escapeBridge.getBridgeView({
          userId: c.get('user').userId,
          trialRecordId: c.req.param('trialRecordId'),
        }),
      ),
    )
    // 사유 선택 = ExitPoll 응답 + CANCEL_ATTEMPTED 전이, 결과로 직링크를 준다 (SPEC §5, §7 단일 명령). 재진입은 위 조회의 REENTRY로 받는다
    .post(
      '/api/trials/:trialRecordId/cancel-attempts',
      requireSession(identity),
      validateJson(cancelAttemptBody),
      async (c) =>
        c.json(
          await escapeBridge.selectExitReason({
            userId: c.get('user').userId,
            trialRecordId: c.req.param('trialRecordId'),
            ...c.req.valid('json'),
          }),
        ),
    );
