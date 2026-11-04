import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { seedItem } from '../support/catalog-seed';
import { FakeClock } from '../support/fake-clock';

function setup() {
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  const catalog = createCatalogService({ db: env.DB, clock });
  return { clock, catalog };
}

describe('CM 공개 카탈로그 목록 [S1][S2][T10]', () => {
  it('V-01 PUBLISHED·UNPUBLISHED 항목만 나오고 SUBMITTED·REJECTED 항목은 제외된다', async () => {
    const { catalog } = setup();
    const published = await seedItem(catalog, 'PUBLISHED');
    const unpublished = await seedItem(catalog, 'UNPUBLISHED');
    const submitted = await seedItem(catalog, 'SUBMITTED');
    const rejected = await seedItem(catalog, 'REJECTED');

    const items = await catalog.listCatalog();

    const ids = items.map((item) => item.id);
    expect(ids).toContain(published.id);
    expect(ids).toContain(unpublished.id);
    expect(ids).not.toContain(submitted.id);
    expect(ids).not.toContain(rejected.id);
  });

  it('V-01 serviceCategory로 조회하면 해당 분야 항목만 돌려준다', async () => {
    const { catalog } = setup();
    const ott = await seedItem(catalog, 'PUBLISHED', { serviceCategory: 'OTT' });
    const ai = await seedItem(catalog, 'PUBLISHED', { serviceCategory: 'AI' });

    const items = await catalog.listCatalog({ category: 'AI' });

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.serviceCategory === 'AI')).toBe(true);
    expect(items.map((item) => item.id)).toContain(ai.id);
    expect(items.map((item) => item.id)).not.toContain(ott.id);
  });

  it('q로 서비스명 일부를 검색한다 (영문은 대소문자 무시, 노출 대상 상태만)', async () => {
    const { catalog } = setup();
    const tag = crypto.randomUUID().slice(0, 8);
    const hit = await seedItem(catalog, 'PUBLISHED', { name: `Netflix-${tag} 프리미엄` });
    const other = await seedItem(catalog, 'PUBLISHED', { name: `Spotify-${tag}` });
    const hiddenSponsored = await seedItem(catalog, 'SUBMITTED', { name: `Netflix-${tag} 제휴` });

    const byEnglish = await catalog.listCatalog({ q: `netflix-${tag}` });
    const byKorean = await catalog.listCatalog({ q: '프리미엄' });

    expect(byEnglish.map((item) => item.id)).toEqual([hit.id]);
    expect(byKorean.map((item) => item.id)).toContain(hit.id);
    expect(byEnglish.map((item) => item.id)).not.toContain(other.id);
    expect(byEnglish.map((item) => item.id)).not.toContain(hiddenSponsored.id);
  });

  it('q의 % · _ 는 와일드카드가 아니라 글자로 검색한다', async () => {
    const { catalog } = setup();
    const tag = crypto.randomUUID().slice(0, 8);
    const literal = await seedItem(catalog, 'PUBLISHED', { name: `50%할인-${tag}` });
    // 와일드카드로 해석되면 '%'·'_' 자리에 이 이름도 걸린다
    await seedItem(catalog, 'PUBLISHED', { name: `50원할인-${tag}` });

    const byPercent = await catalog.listCatalog({ q: `50%할인-${tag}` });
    const byUnderscore = await catalog.listCatalog({ q: `50_할인-${tag}` });

    expect(byPercent.map((item) => item.id)).toEqual([literal.id]);
    expect(byUnderscore).toEqual([]);
  });

  it('q가 비어 있거나 공백뿐이면 검색 조건 없이 전체를 돌려준다', async () => {
    const { catalog } = setup();
    const item = await seedItem(catalog, 'PUBLISHED');

    const blank = await catalog.listCatalog({ q: '   ' });

    expect(blank.map((found) => found.id)).toContain(item.id);
  });
});

/** 관리용 필드. 공개 응답에 하나라도 있으면 안 된다 (SPEC §7, §19) */
const ADMIN_ONLY_FIELDS = [
  'escapeLink',
  'escapeLinkFallbackUrl',
  'ownerPartnerId',
  'darkPatternScores',
] as const;

const SECRET_URLS = ['https://example.com/cancel', 'https://example.com/pc-fallback'];

describe('CM 공개 카탈로그 상세 [S1][S4][S5][S6][T10]', () => {
  it('V-03 상세에 해지 경로 유형·등급·가이드·보존 정책·백업·EduBenefit·최종 검증일이 담긴다', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'PUBLISHED', {
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: ['작업물 내보내기'],
      eduBenefit: { description: '학생 할인', url: 'https://example.com/edu' },
    });

    const view = await catalog.getCatalogItem(created.id);

    expect(view).toMatchObject({
      id: created.id,
      escapePattern: 'DIRECT_LINK',
      darkPatternLevel: 'MEDIUM',
      escapeGuideSteps: ['설정에서 멤버십을 연다', '해지를 누른다'],
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
      backupChecklist: ['작업물 내보내기'],
      eduBenefit: { description: '학생 할인', url: 'https://example.com/edu' },
      lastVerifiedAt: '2026-11-02',
    });
  });

  it('EB 목록·상세 응답에 escapeLink·escapeLinkFallbackUrl·ownerPartnerId·darkPatternScores가 없다', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'PUBLISHED', {
      kind: 'SPONSORED_TRIAL',
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://example.com/pc-fallback',
      darkPatternScores: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 2 },
    });

    const detail = await catalog.getCatalogItem(created.id);
    const listed = (await catalog.listCatalog()).find((item) => item.id === created.id);

    for (const view of [detail, listed]) {
      expect(view).toMatchObject({
        id: created.id,
        forcedChannel: 'APP',
        darkPatternLevel: 'HIGH',
      });
      for (const field of ADMIN_ONLY_FIELDS) expect(view).not.toHaveProperty(field);
      // 필드 이름이 아니라 값으로도 새지 않는지 확인한다
      for (const url of SECRET_URLS) expect(JSON.stringify(view)).not.toContain(url);
    }
  });

  it('V-08 UNPUBLISHED 항목도 상세에 나오되 publicationStatus가 UNPUBLISHED로 내려간다', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'UNPUBLISHED');

    const view = await catalog.getCatalogItem(created.id);

    expect(view.publicationStatus).toBe('UNPUBLISHED');
  });

  it('V-08 목록의 publicationStatus는 PUBLISHED·UNPUBLISHED 두 값으로만 내려간다', async () => {
    const { catalog } = setup();
    await seedItem(catalog, 'PUBLISHED');
    await seedItem(catalog, 'UNPUBLISHED');
    await seedItem(catalog, 'SUBMITTED');
    await seedItem(catalog, 'REJECTED');

    const statuses = new Set((await catalog.listCatalog()).map((item) => item.publicationStatus));

    expect([...statuses].sort()).toEqual(['PUBLISHED', 'UNPUBLISHED']);
  });

  it('SUBMITTED·REJECTED 항목과 없는 id는 NOT_FOUND다 (존재 여부를 드러내지 않는다)', async () => {
    const { catalog } = setup();
    const submitted = await seedItem(catalog, 'SUBMITTED');
    const rejected = await seedItem(catalog, 'REJECTED');

    for (const id of [submitted.id, rejected.id, 'no-such-item']) {
      await expect(catalog.getCatalogItem(id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });
});

describe('CM 다른 모듈용 내부 조회 [S7][S16][T10]', () => {
  it('getTrackingTerms가 기록 생성에 필요한 조건만 돌려준다 (게시 상태 포함)', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'UNPUBLISHED', {
      monthlyPrice: 12000,
      defaultTrialDays: 14,
      isGlobalTimeZoneBufferRequired: false,
      serviceCategory: 'AI',
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
    });

    const terms = await catalog.getTrackingTerms(created.id);

    expect(terms).toEqual({
      name: created.name,
      publicationStatus: 'UNPUBLISHED',
      defaultTrialDays: 14,
      isGlobalTimeZoneBufferRequired: false,
      monthlyPrice: 12000,
      serviceCategory: 'AI',
      accessRetentionPolicy: 'IMMEDIATE_TERMINATION',
    });
  });

  it('getTrackingTerms는 SUBMITTED 항목도 상태와 함께 돌려줘 호출한 쪽이 거부할 수 있다', async () => {
    const { catalog } = setup();
    const submitted = await seedItem(catalog, 'SUBMITTED');

    const terms = await catalog.getTrackingTerms(submitted.id);

    expect(terms.publicationStatus).toBe('SUBMITTED');
  });

  it('getEscapeContent는 직링크를 포함해 해지 안내 전체를 돌려준다 (UNPUBLISHED여도 기존 기록용)', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'UNPUBLISHED');

    const content = await catalog.getEscapeContent(created.id);

    expect(content).toEqual({
      name: created.name,
      escapePattern: 'DIRECT_LINK',
      escapeGuideSteps: ['설정에서 멤버십을 연다', '해지를 누른다'],
      escapeLink: 'https://example.com/cancel',
      accessRetentionPolicy: 'RETAIN_UNTIL_END',
      supportContact: { email: 'help@example.com' },
      lastVerifiedAt: '2026-11-02',
    });
  });

  it('getEscapeContent는 forcedChannel·대체 URL·백업 체크리스트가 있으면 함께 돌려준다', async () => {
    const { catalog } = setup();
    const created = await seedItem(catalog, 'PUBLISHED', {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://example.com/pc-fallback',
      backupChecklist: ['작업물 내보내기'],
    });

    const content = await catalog.getEscapeContent(created.id);

    expect(content).toMatchObject({
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://example.com/pc-fallback',
      backupChecklist: ['작업물 내보내기'],
    });
  });

  it('없는 id는 두 조회 모두 NOT_FOUND다', async () => {
    const { catalog } = setup();

    await expect(catalog.getTrackingTerms('no-such-item')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(catalog.getEscapeContent('no-such-item')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
