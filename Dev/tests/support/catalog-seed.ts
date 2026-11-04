import { env } from 'cloudflare:test';
import type { CatalogService } from '../../src/worker/modules/catalog';
import { catalogInput, type CatalogItemInput } from './catalog-fixtures';

export const operator = { userId: 'operator-1', role: 'OPERATOR' } as const;

export type SeedStatus = 'SUBMITTED' | 'PUBLISHED' | 'REJECTED' | 'UNPUBLISHED';

export async function insertPartner(id: string) {
  await env.DB.prepare(
    "INSERT INTO partners (id, company_name, contact_email, created_at) VALUES (?, '시연용 파트너', 'partner@example.com', '2026-11-01T00:00:00.000Z')",
  )
    .bind(id)
    .run();
}

/** 원하는 게시 상태의 항목을 명령 인터페이스로 만든다. 이름이 겹치지 않도록 접미사를 붙인다 */
export async function seedItem(
  catalog: Pick<CatalogService, 'createCatalogItem' | 'changePublicationStatus'>,
  status: SeedStatus,
  overrides: Partial<CatalogItemInput> = {},
) {
  const tag = crypto.randomUUID().slice(0, 8);
  const sponsored = status === 'SUBMITTED' || status === 'REJECTED';
  let input = catalogInput({ name: `${status}-${tag}`, ...overrides });
  if (sponsored || input.kind === 'SPONSORED_TRIAL') {
    const partnerId = `partner-${tag}`;
    await insertPartner(partnerId);
    input = {
      ...input,
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://partner.example.com/signup',
      ownerPartnerId: partnerId,
    };
  }

  const created = await catalog.createCatalogItem(operator, input);
  // GUARDED_SERVICE는 PUBLISHED로, SPONSORED_TRIAL은 SUBMITTED로 시작하므로 이미 지난 단계는 건너뛴다
  const route: Record<SeedStatus, SeedStatus[]> = {
    SUBMITTED: [],
    REJECTED: ['REJECTED'],
    PUBLISHED: ['PUBLISHED'],
    UNPUBLISHED: ['PUBLISHED', 'UNPUBLISHED'],
  };
  let current: SeedStatus = created.publicationStatus;
  for (const to of route[status]) {
    if (to === current) continue;
    await catalog.changePublicationStatus(operator, created.id, to);
    current = to;
  }
  return { ...created, publicationStatus: current };
}
