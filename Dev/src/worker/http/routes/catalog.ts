import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { serviceCategory } from '../catalog-schemas';
import type { AppDeps } from '../deps';
import { validateQuery } from '../validate';

// 공개 API: 세션 없이 호출한다. 응답은 catalog 모듈이 만든 CatalogItemPublicView뿐이다 (SPEC §7)
const listQuery = z.object({
  category: serviceCategory.optional(),
  q: z.string().max(100).optional(),
});

export const catalogRoutes = ({ catalog }: Pick<AppDeps, 'catalog'>) =>
  new Hono<AppEnv>()
    .get('/api/catalog', validateQuery(listQuery), async (c) =>
      c.json({ items: await catalog.listCatalog(c.req.valid('query')) }),
    )
    .get('/api/catalog/:catalogItemId', async (c) =>
      c.json(await catalog.getCatalogItem(c.req.param('catalogItemId'))),
    );
