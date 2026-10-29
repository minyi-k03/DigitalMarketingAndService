import { Hono } from 'hono';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { requireSession, unauthenticated } from '../middleware/session';

export const meRoutes = ({ identity }: Pick<AppDeps, 'identity'>) =>
  new Hono<AppEnv>().get('/api/me', requireSession(identity), async (c) => {
    const me = await identity.getMe(c.get('user').userId);
    // 세션은 있는데 사용자가 없는 경우(삭제 경합)는 인증되지 않은 것으로 본다
    if (!me) throw unauthenticated(c.req.url);
    return c.json(me);
  });
