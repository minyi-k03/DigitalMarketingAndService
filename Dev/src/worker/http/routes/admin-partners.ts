import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import type { AppDeps } from '../deps';
import { validateJson } from '../validate';

// api/openapi.yaml GET·POST /api/admin/partners. 권한(OPERATOR+)은 app.ts의 /api/admin/* 가드가 건다.
// 이메일 형식 같은 도메인 검사는 catalog 모듈이 맡는다.
const partnerInput = z.strictObject({
  companyName: z.string().min(1),
  contactEmail: z.string().min(1),
});

export const adminPartnerRoutes = ({ catalog }: Pick<AppDeps, 'catalog'>) =>
  new Hono<AppEnv>()
    .get('/api/admin/partners', async (c) => c.json({ items: await catalog.listPartners() }))
    .post('/api/admin/partners', validateJson(partnerInput), async (c) =>
      c.json(await catalog.createPartner(c.req.valid('json')), 201),
    );
