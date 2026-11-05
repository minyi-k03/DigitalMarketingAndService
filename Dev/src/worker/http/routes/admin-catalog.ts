import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app-env';
import { serviceCategory } from '../catalog-schemas';
import type { AppDeps } from '../deps';
import { validateJson, validateQuery } from '../validate';

// api/openapi.yaml의 CatalogItemInput·CatalogItemPatch와 같은 모양이다.
// 알 수 없는 필드는 조용히 버리지 않고 400으로 알린다(예: 수정할 수 없는 kind).
// 길이·범위 같은 형식 검사는 여기서, 서로 얽힌 도메인 규칙(SPEC §2)은 catalog 모듈이 맡는다.
const publicationStatus = z.enum(['SUBMITTED', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED']);

const darkPatternScores = z.strictObject({
  menuDepth: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  persuasionPopups: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  forcedPcOrApp: z.union([z.literal(0), z.literal(2)]),
});

const catalogItemInput = z.strictObject({
  kind: z.enum(['GUARDED_SERVICE', 'SPONSORED_TRIAL']),
  name: z.string().min(1),
  signupUrl: z.string().optional(),
  ownerPartnerId: z.string().optional(),
  serviceCategory,
  monthlyPrice: z.number().int().min(0),
  defaultTrialDays: z.number().int().min(1).max(365),
  isGlobalTimeZoneBufferRequired: z.boolean(),
  darkPatternScores,
  escapePattern: z.enum(['DIRECT_LINK', 'SPA_MODAL_GUIDE', 'PC_OR_APP_FORCED']),
  forcedChannel: z.enum(['APP', 'PC_WEB']).optional(),
  escapeGuideSteps: z.array(z.string().min(1)).min(1).max(3),
  escapeLink: z.string(),
  escapeLinkFallbackUrl: z.string().optional(),
  accessRetentionPolicy: z.enum(['RETAIN_UNTIL_END', 'IMMEDIATE_TERMINATION']),
  backupChecklist: z.array(z.string()).optional(),
  eduBenefit: z.strictObject({ description: z.string(), url: z.string() }).optional(),
  supportContact: z.strictObject({
    email: z.string().optional(),
    url: z.string().optional(),
  }),
});

// 수정 요청: 생략은 "그대로", null은 "지운다". 등록 때 선택이던 필드만 null을 받는다
// (필수 필드에 null이 오면 400이고, 지운 결과가 도메인 규칙에 어긋나면 catalog 모듈이 400으로 알린다)
const nullableOnPatch = {
  signupUrl: catalogItemInput.shape.signupUrl.nullable(),
  ownerPartnerId: catalogItemInput.shape.ownerPartnerId.nullable(),
  forcedChannel: catalogItemInput.shape.forcedChannel.nullable(),
  escapeLinkFallbackUrl: catalogItemInput.shape.escapeLinkFallbackUrl.nullable(),
  backupChecklist: catalogItemInput.shape.backupChecklist.nullable(),
  eduBenefit: catalogItemInput.shape.eduBenefit.nullable(),
};
const catalogItemPatch = catalogItemInput.omit({ kind: true }).partial().extend(nullableOnPatch);

const updateRequest = z.strictObject({
  changes: catalogItemPatch,
  applyBufferToActiveRecords: z.boolean().optional(),
  markVerified: z.boolean().optional(),
});

export const adminCatalogRoutes = ({ catalog }: Pick<AppDeps, 'catalog'>) =>
  new Hono<AppEnv>()
    .get(
      '/api/admin/catalog-items',
      validateQuery(z.object({ publicationStatus: publicationStatus.optional() })),
      async (c) => {
        const items = await catalog.listAdminCatalogItems(c.req.valid('query'));
        return c.json({ items });
      },
    )
    .post('/api/admin/catalog-items', validateJson(catalogItemInput), async (c) => {
      const created = await catalog.createCatalogItem(c.get('user'), c.req.valid('json'));
      return c.json(created, 201);
    })
    .get('/api/admin/catalog-items/:catalogItemId', async (c) =>
      c.json(await catalog.getAdminCatalogItem(c.req.param('catalogItemId'))),
    )
    .patch('/api/admin/catalog-items/:catalogItemId', validateJson(updateRequest), async (c) =>
      c.json(
        await catalog.updateCatalogItem(
          c.get('user'),
          c.req.param('catalogItemId'),
          c.req.valid('json'),
        ),
      ),
    )
    .post(
      '/api/admin/catalog-items/:catalogItemId/publication-status',
      validateJson(z.strictObject({ to: publicationStatus })),
      async (c) =>
        c.json(
          await catalog.changePublicationStatus(
            c.get('user'),
            c.req.param('catalogItemId'),
            c.req.valid('json').to,
          ),
        ),
    )
    .get('/api/admin/catalog-items/:catalogItemId/change-logs', async (c) =>
      c.json({ items: await catalog.listChangeLogs(c.req.param('catalogItemId')) }),
    );
