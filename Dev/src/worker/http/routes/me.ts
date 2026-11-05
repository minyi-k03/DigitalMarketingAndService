import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { requireSession, unauthenticated } from '../middleware/session';
import { validateJson } from '../validate';

// api/openapi.yaml의 PUT /api/me/notification-settings 요청 본문. 알 수 없는 필드는 400으로 알린다
const notificationSettings = z.strictObject({ notificationEnabled: z.boolean() });

export const meRoutes = ({ identity }: Pick<AppDeps, 'identity'>) =>
  new Hono<AppEnv>()
    .get('/api/me', requireSession(identity), async (c) => {
      const me = await identity.getMe(c.get('user').userId);
      // 세션은 있는데 사용자가 없는 경우(삭제 경합)는 인증되지 않은 것으로 본다
      if (!me) throw unauthenticated(c.req.url);
      return c.json(me);
    })
    .put(
      '/api/me/notification-settings',
      requireSession(identity),
      validateJson(notificationSettings),
      async (c) => {
        const me = await identity.setNotificationEnabled(
          c.get('user').userId,
          c.req.valid('json').notificationEnabled,
        );
        if (!me) throw unauthenticated(c.req.url);
        return c.json(me);
      },
    );
