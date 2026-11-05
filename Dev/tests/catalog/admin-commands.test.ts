import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { FakeClock } from '../support/fake-clock';
import { catalogInput } from '../support/catalog-fixtures';

const operator = { userId: 'operator-1', role: 'OPERATOR' } as const;

function setup() {
  // UTC 01:00 = KST 10:00, 오늘(KST)은 2026-11-02
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  const catalog = createCatalogService({ db: env.DB, clock });
  return { clock, catalog };
}

async function insertPartner(id: string) {
  await env.DB.prepare(
    "INSERT INTO partners (id, company_name, contact_email, created_at) VALUES (?, '시연용 파트너', 'partner@example.com', '2026-11-01T00:00:00.000Z')",
  )
    .bind(id)
    .run();
}

describe('CM 카탈로그 등록 규칙 [S38][T09]', () => {
  it('검증에 어긋나면 VALIDATION_FAILED와 필드별 오류를 던진다', async () => {
    const { catalog } = setup();

    await expect(
      catalog.createCatalogItem(operator, catalogInput({ escapeGuideSteps: [] })),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field: 'escapeGuideSteps' })] },
    });
  });

  it('SPONSORED_TRIAL은 검수 전 SUBMITTED로 생성된다', async () => {
    const { catalog } = setup();
    await insertPartner('partner-sponsored');

    const created = await catalog.createCatalogItem(
      operator,
      catalogInput({
        kind: 'SPONSORED_TRIAL',
        signupUrl: 'https://partner.example.com/signup',
        ownerPartnerId: 'partner-sponsored',
      }),
    );

    expect(created).toMatchObject({ kind: 'SPONSORED_TRIAL', publicationStatus: 'SUBMITTED' });
  });

  it('존재하지 않는 ownerPartnerId는 VALIDATION_FAILED다 (서버 오류로 새지 않는다)', async () => {
    const { catalog } = setup();

    await expect(
      catalog.createCatalogItem(
        operator,
        catalogInput({
          kind: 'SPONSORED_TRIAL',
          signupUrl: 'https://partner.example.com/signup',
          ownerPartnerId: 'no-such-partner',
        }),
      ),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field: 'ownerPartnerId' })] },
    });
  });

  it('운영 설정에 등록된 앱 스킴은 forcedChannel = APP 항목의 escapeLink로 허용된다 [G4]', async () => {
    const { catalog } = setup();
    const appItem = catalogInput({
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLink: 'myapp://cancel',
      escapeLinkFallbackUrl: 'https://apps.example.com/app',
    });

    await expect(catalog.createCatalogItem(operator, appItem)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    await env.DB.prepare(
      "UPDATE app_settings SET value = '[\"myapp\"]' WHERE key = 'catalog.allowedDeepLinkSchemes'",
    ).run();

    await expect(catalog.createCatalogItem(operator, appItem)).resolves.toMatchObject({
      escapeLink: 'myapp://cancel',
    });
  });
});

type Catalog = ReturnType<typeof setup>['catalog'];

/** 검수 대기(SUBMITTED) 항목을 하나 만든다 */
async function createSubmitted(catalog: Catalog) {
  const partnerId = `partner-${crypto.randomUUID()}`;
  await insertPartner(partnerId);
  return catalog.createCatalogItem(
    operator,
    catalogInput({
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://partner.example.com/signup',
      ownerPartnerId: partnerId,
    }),
  );
}

const publishedAtOf = (id: string) =>
  env.DB.prepare('SELECT published_at FROM catalog_items WHERE id = ?')
    .bind(id)
    .first<{ published_at: string | null }>()
    // publishedAt은 아직 어떤 공개 조회도 내놓지 않아(T60에서 라운지 정렬에 쓴다) 저장값을 직접 본다
    .then((row) => row?.published_at);

describe('CM 게시 상태 전이 [S38][S47][T09]', () => {
  it('SUBMITTED → PUBLISHED는 게시 시각을 기록하고 변경 이력을 남긴다', async () => {
    const { catalog, clock } = setup();
    const item = await createSubmitted(catalog);
    expect(await publishedAtOf(item.id)).toBeNull();
    clock.set('2026-11-03T03:00:00.000Z');

    const published = await catalog.changePublicationStatus(operator, item.id, 'PUBLISHED');

    expect(published.publicationStatus).toBe('PUBLISHED');
    expect(await catalog.getAdminCatalogItem(item.id)).toEqual(published);
    expect(await publishedAtOf(item.id)).toBe('2026-11-03T03:00:00.000Z');
    const [latest] = await catalog.listChangeLogs(item.id);
    expect(latest).toMatchObject({
      catalogItemId: item.id,
      changedBy: 'operator-1',
      changedAt: '2026-11-03T03:00:00.000Z',
      changes: [{ field: 'publicationStatus', before: 'SUBMITTED', after: 'PUBLISHED' }],
      appliedToActiveRecords: false,
    });
  });

  it('SUBMITTED → REJECTED, PUBLISHED → UNPUBLISHED는 허용된다', async () => {
    const { catalog } = setup();
    const toReject = await createSubmitted(catalog);
    const toUnpublish = await catalog.createCatalogItem(operator, catalogInput());

    const rejected = await catalog.changePublicationStatus(operator, toReject.id, 'REJECTED');
    const unpublished = await catalog.changePublicationStatus(
      operator,
      toUnpublish.id,
      'UNPUBLISHED',
    );

    expect(rejected.publicationStatus).toBe('REJECTED');
    expect(unpublished.publicationStatus).toBe('UNPUBLISHED');
  });

  it.each([
    ['PUBLISHED', 'PUBLISHED'],
    ['PUBLISHED', 'REJECTED'],
    ['PUBLISHED', 'SUBMITTED'],
    ['SUBMITTED', 'UNPUBLISHED'],
    ['REJECTED', 'PUBLISHED'],
    ['UNPUBLISHED', 'PUBLISHED'],
  ] as const)('%s → %s 는 INVALID_TRANSITION이다', async (from, to) => {
    const { catalog } = setup();
    const item =
      from === 'SUBMITTED' || from === 'REJECTED'
        ? await createSubmitted(catalog)
        : await catalog.createCatalogItem(operator, catalogInput());
    if (from === 'REJECTED') await catalog.changePublicationStatus(operator, item.id, 'REJECTED');
    if (from === 'UNPUBLISHED') {
      await catalog.changePublicationStatus(operator, item.id, 'UNPUBLISHED');
    }

    await expect(catalog.changePublicationStatus(operator, item.id, to)).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    expect((await catalog.getAdminCatalogItem(item.id)).publicationStatus).toBe(from);
  });

  it('없는 항목은 NOT_FOUND다', async () => {
    const { catalog } = setup();

    await expect(
      catalog.changePublicationStatus(operator, 'no-such-item', 'UNPUBLISHED'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('같은 항목을 동시에 서로 다르게 바꾸면 하나만 적용되고 이력도 한 건만 남는다', async () => {
    const { catalog } = setup();
    const item = await createSubmitted(catalog);

    const results = await Promise.allSettled([
      catalog.changePublicationStatus(operator, item.id, 'PUBLISHED'),
      catalog.changePublicationStatus(operator, item.id, 'REJECTED'),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const failure = results.find((r) => r.status === 'rejected');
    expect(failure).toMatchObject({ reason: { code: 'CONFLICT' } });
    // 등록 이력 1건 + 상태 변경 이력 1건
    expect(await catalog.listChangeLogs(item.id)).toHaveLength(2);
  });
});

describe('CM 변경 이력 조회 [S47][T09]', () => {
  it('생성도 이력으로 남고 최신 변경이 먼저 나온다', async () => {
    const { catalog, clock } = setup();
    const item = await createSubmitted(catalog);
    clock.advanceBy(60_000);
    await catalog.changePublicationStatus(operator, item.id, 'PUBLISHED');

    const logs = await catalog.listChangeLogs(item.id);

    expect(logs.map((l) => l.changes)).toEqual([
      [{ field: 'publicationStatus', before: 'SUBMITTED', after: 'PUBLISHED' }],
      [{ field: 'publicationStatus', after: 'SUBMITTED' }],
    ]);
  });

  it('다른 항목의 이력은 섞이지 않는다', async () => {
    const { catalog } = setup();
    const a = await catalog.createCatalogItem(operator, catalogInput());
    const b = await catalog.createCatalogItem(operator, catalogInput());
    await catalog.changePublicationStatus(operator, a.id, 'UNPUBLISHED');

    expect(await catalog.listChangeLogs(a.id)).toHaveLength(2);
    expect(await catalog.listChangeLogs(b.id)).toHaveLength(1);
  });
});

describe('CM 카탈로그 수정과 변경 이력 [S47][T09]', () => {
  it('바뀐 필드만 이전 값·새 값으로 이력에 남기고 즉시 반영한다', async () => {
    const { catalog, clock } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput());
    clock.set('2026-11-03T03:00:00.000Z');

    const updated = await catalog.updateCatalogItem(operator, item.id, {
      changes: { name: '이름 변경', monthlyPrice: 12000 },
    });

    expect(updated).toEqual({ ...item, name: '이름 변경', monthlyPrice: 12000 });
    expect(await catalog.getAdminCatalogItem(item.id)).toEqual(updated);
    const [latest] = await catalog.listChangeLogs(item.id);
    expect(latest).toMatchObject({
      changedBy: 'operator-1',
      changedAt: '2026-11-03T03:00:00.000Z',
      appliedToActiveRecords: false,
    });
    expect(latest?.changes).toHaveLength(2);
    expect(latest?.changes).toEqual(
      expect.arrayContaining([
        { field: 'name', before: '시연용 OTT', after: '이름 변경' },
        { field: 'monthlyPrice', before: 9900, after: 12000 },
      ]),
    );
  });

  it('원점수를 바꾸면 등급을 다시 계산하고 등급 변경도 이력에 남긴다', async () => {
    const { catalog } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput()); // 합 2 → MEDIUM

    const updated = await catalog.updateCatalogItem(operator, item.id, {
      changes: { darkPatternScores: { menuDepth: 2, persuasionPopups: 2, forcedPcOrApp: 0 } },
    });

    expect(updated.darkPatternLevel).toBe('HIGH'); // 합 4
    const [latest] = await catalog.listChangeLogs(item.id);
    expect(latest?.changes).toEqual(
      expect.arrayContaining([
        { field: 'darkPatternLevel', before: 'MEDIUM', after: 'HIGH' },
        {
          field: 'darkPatternScores',
          before: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 },
          after: { menuDepth: 2, persuasionPopups: 2, forcedPcOrApp: 0 },
        },
      ]),
    );
  });

  it('값이 그대로면 이력을 남기지 않는다', async () => {
    const { catalog } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput());

    const result = await catalog.updateCatalogItem(operator, item.id, {
      changes: { name: item.name, supportContact: { email: 'help@example.com' } },
    });

    expect(result).toEqual(item);
    expect(await catalog.listChangeLogs(item.id)).toHaveLength(1); // 등록 이력만
  });

  it('markVerified를 켜면 최종 검증일이 오늘(KST)로 갱신된다', async () => {
    const { catalog, clock } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput());
    clock.set('2026-11-10T01:00:00.000Z');

    const verified = await catalog.updateCatalogItem(operator, item.id, {
      changes: {},
      markVerified: true,
    });

    expect(verified.lastVerifiedAt).toBe('2026-11-10');
    const [latest] = await catalog.listChangeLogs(item.id);
    expect(latest?.changes).toEqual([
      { field: 'lastVerifiedAt', before: '2026-11-02', after: '2026-11-10' },
    ]);
  });

  it('수정 결과가 검증 규칙을 어기면 VALIDATION_FAILED이고 아무것도 바뀌지 않는다', async () => {
    const { catalog } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput());

    await expect(
      catalog.updateCatalogItem(operator, item.id, {
        changes: { escapePattern: 'PC_OR_APP_FORCED' }, // forcedChannel 없이 강제 접속으로 변경
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field: 'forcedChannel' })] },
    });
    await expect(
      catalog.updateCatalogItem(operator, item.id, {
        changes: { ownerPartnerId: 'no-such-partner' },
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field: 'ownerPartnerId' })] },
    });

    expect(await catalog.getAdminCatalogItem(item.id)).toEqual(item);
    expect(await catalog.listChangeLogs(item.id)).toHaveLength(1);
  });

  it('applyBufferToActiveRecords는 아직 지원하지 않아 거부한다 (T16에서 연결)', async () => {
    const { catalog } = setup();
    const item = await catalog.createCatalogItem(operator, catalogInput());

    await expect(
      catalog.updateCatalogItem(operator, item.id, {
        changes: { isGlobalTimeZoneBufferRequired: false },
        applyBufferToActiveRecords: true,
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: [expect.objectContaining({ field: 'applyBufferToActiveRecords' })] },
    });
    expect(await catalog.getAdminCatalogItem(item.id)).toEqual(item);
  });

  it('없는 항목은 NOT_FOUND다', async () => {
    const { catalog } = setup();

    await expect(
      catalog.updateCatalogItem(operator, 'no-such-item', { changes: { name: 'x' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('CM 관리용 카탈로그 목록 [S38][T09]', () => {
  it('모든 게시 상태를 보여 주고 publicationStatus로 걸러낼 수 있다', async () => {
    const { catalog } = setup();
    const published = await catalog.createCatalogItem(operator, catalogInput());
    const submitted = await createSubmitted(catalog);
    const rejected = await createSubmitted(catalog);
    await catalog.changePublicationStatus(operator, rejected.id, 'REJECTED');

    const all = await catalog.listAdminCatalogItems();
    const onlySubmitted = await catalog.listAdminCatalogItems({ publicationStatus: 'SUBMITTED' });

    const idsOf = (items: { id: string }[]) => items.map((i) => i.id);
    expect(idsOf(all)).toEqual(expect.arrayContaining([published.id, submitted.id, rejected.id]));
    expect(idsOf(onlySubmitted)).toContain(submitted.id);
    expect(idsOf(onlySubmitted)).not.toContain(published.id);
    expect(idsOf(onlySubmitted)).not.toContain(rejected.id);
    expect(all.find((i) => i.id === rejected.id)?.publicationStatus).toBe('REJECTED');
  });
});

describe('CM 카탈로그 등록 [S38][S47][T09]', () => {
  it('GUARDED_SERVICE는 PUBLISHED로 생성되고 등급과 최종 검증일은 서버가 정한다', async () => {
    const { catalog } = setup();

    const created = await catalog.createCatalogItem(operator, catalogInput());

    expect(created).toMatchObject({
      kind: 'GUARDED_SERVICE',
      name: '시연용 OTT',
      publicationStatus: 'PUBLISHED',
      darkPatternLevel: 'MEDIUM', // 원점수 합 2, 기본 기준표 mediumMin = 2
      lastVerifiedAt: '2026-11-02',
    });
    expect(created.id).toEqual(expect.any(String));
    expect(await catalog.getAdminCatalogItem(created.id)).toEqual(created);
  });
});

describe('CM 카탈로그 입력 검증 보강 [S38][T09]', () => {
  it.each(['', '   '])(
    '해지 가이드 단계가 비어 있으면(%j) escapeGuideSteps 검증 오류다',
    async (blankStep) => {
      const { catalog } = setup();

      await expect(
        catalog.createCatalogItem(
          operator,
          catalogInput({ escapeGuideSteps: ['설정에서 멤버십을 연다', blankStep] }),
        ),
      ).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        extensions: { errors: [expect.objectContaining({ field: 'escapeGuideSteps' })] },
      });
    },
  );

  // 값이 없으면 필드를 보내지 않는다. 보냈는데 비어 있으면 빈 값이 저장되므로 거부한다
  it.each([
    { name: 'signupUrl', field: 'signupUrl', input: { signupUrl: '' } },
    {
      name: 'escapeLinkFallbackUrl',
      field: 'escapeLinkFallbackUrl',
      input: { escapeLinkFallbackUrl: '   ' },
    },
    {
      name: 'eduBenefit.url',
      field: 'eduBenefit.url',
      input: { eduBenefit: { description: '학생 할인', url: '' } },
    },
    {
      name: 'eduBenefit.description',
      field: 'eduBenefit.description',
      input: { eduBenefit: { description: '  ', url: 'https://edu.example.com' } },
    },
    {
      name: 'supportContact.email',
      field: 'supportContact.email',
      input: { supportContact: { email: '', url: 'https://help.example.com' } },
    },
    {
      name: 'supportContact.url',
      field: 'supportContact.url',
      input: { supportContact: { email: 'help@example.com', url: '   ' } },
    },
  ])('값이 있는데 비어 있는 $name은 검증 오류다', async ({ field, input }) => {
    const { catalog } = setup();

    await expect(catalog.createCatalogItem(operator, catalogInput(input))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: { errors: expect.arrayContaining([expect.objectContaining({ field })]) },
    });
  });

  it('PC_OR_APP_FORCED 항목을 다른 해지 방식으로 바꾸면 강제 접속 채널이 함께 비워진다 [D-15]', async () => {
    const { catalog } = setup();
    const forced = await catalog.createCatalogItem(
      operator,
      catalogInput({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' }),
    );

    const updated = await catalog.updateCatalogItem(operator, forced.id, {
      changes: { escapePattern: 'DIRECT_LINK' },
    });

    expect(updated.escapePattern).toBe('DIRECT_LINK');
    expect(updated.forcedChannel).toBeUndefined();
    expect(await catalog.getAdminCatalogItem(forced.id)).toEqual(updated);
    const [latest] = await catalog.listChangeLogs(forced.id);
    expect(latest?.changes).toEqual(
      expect.arrayContaining([
        { field: 'escapePattern', before: 'PC_OR_APP_FORCED', after: 'DIRECT_LINK' },
        { field: 'forcedChannel', before: 'PC_WEB' },
      ]),
    );
  });
});
