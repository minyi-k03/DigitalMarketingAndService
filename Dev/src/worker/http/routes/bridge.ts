import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { requireSession } from '../middleware/session';

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
    );
