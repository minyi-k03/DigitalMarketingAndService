import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { validateJson, validateQuery } from '../validate';

// api/openapi.yaml GET·PATCH /api/admin/broken-link-reports. 권한(OPERATOR+)은 app.ts의 /api/admin/* 가드가 건다
const listQuery = z.object({
  status: z.enum(['OPEN', 'FIXED', 'REJECTED']).optional(),
  catalogItemId: z.string().min(1).optional(),
});
// 처리 결과만 받는다. OPEN으로 되돌리거나 알 수 없는 필드는 400
const resolveBody = z.strictObject({ status: z.enum(['FIXED', 'REJECTED']) });

export const adminReportRoutes = ({ escapeBridge }: Pick<AppDeps, 'escapeBridge'>) =>
  new Hono<AppEnv>()
    .get('/api/admin/broken-link-reports', validateQuery(listQuery), async (c) =>
      c.json(await escapeBridge.listBrokenLinkReports(c.req.valid('query'))),
    )
    .patch('/api/admin/broken-link-reports/:reportId', validateJson(resolveBody), async (c) =>
      c.json(
        await escapeBridge.resolveBrokenLinkReport(
          c.req.param('reportId'),
          c.req.valid('json').status,
        ),
      ),
    );
