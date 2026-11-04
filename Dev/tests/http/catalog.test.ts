import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { seedItem } from '../support/catalog-seed';
import { buildLoginApp, ORIGIN } from '../support/http-login';

type PublicView = components['schemas']['CatalogItemPublicView'];
type Problem = components['schemas']['Problem'];

const get = (built: ReturnType<typeof buildLoginApp>, path: string) =>
  built.app.request(`${ORIGIN}${path}`);

describe('CM 공개 카탈로그 API [S1][S2][T10]', () => {
  it('V-01 로그인 없이 목록을 조회하고 분야·검색어로 거른다', async () => {
    const built = buildLoginApp();
    const tag = crypto.randomUUID().slice(0, 8);
    const hit = await seedItem(built.catalog, 'PUBLISHED', {
      name: `Notion-${tag}`,
      serviceCategory: 'CLOUD',
    });
    await seedItem(built.catalog, 'PUBLISHED', {
      name: `Notion-${tag}-ott`,
      serviceCategory: 'OTT',
    });
    await seedItem(built.catalog, 'SUBMITTED', {
      name: `Notion-${tag}-제휴`,
      serviceCategory: 'CLOUD',
    });

    const res = await get(built, `/api/catalog?category=CLOUD&q=notion-${tag}`);
    const body = (await res.json()) as { items: PublicView[] };

    expect(res.status).toBe(200);
    expect(body.items.map((item) => item.id)).toEqual([hit.id]);
  });

  it('EB 응답 본문 어디에도 해지 직링크와 대체 URL이 없다', async () => {
    const built = buildLoginApp();
    const created = await seedItem(built.catalog, 'PUBLISHED', {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLink: 'https://example.com/cancel-secret',
      escapeLinkFallbackUrl: 'https://example.com/pc-fallback-secret',
    });

    const list = await get(built, '/api/catalog');
    const detail = await get(built, `/api/catalog/${created.id}`);

    for (const res of [list, detail]) {
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(text).toContain(created.id);
      expect(text).not.toContain('cancel-secret');
      expect(text).not.toContain('pc-fallback-secret');
      expect(text).not.toContain('escapeLink');
    }
  });

  it('잘못된 category나 너무 긴 q는 400 VALIDATION_FAILED problem+json이다', async () => {
    const built = buildLoginApp();

    const badCategory = await get(built, '/api/catalog?category=NOPE');
    const longQuery = await get(built, `/api/catalog?q=${'가'.repeat(101)}`);

    for (const res of [badCategory, longQuery]) {
      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expect(((await res.json()) as Problem).code).toBe('VALIDATION_FAILED');
    }
  });

  it('V-08 상세는 UNPUBLISHED도 200과 게시 중단 상태로 내려간다', async () => {
    const built = buildLoginApp();
    const created = await seedItem(built.catalog, 'UNPUBLISHED');

    const res = await get(built, `/api/catalog/${created.id}`);
    const body = (await res.json()) as PublicView;

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: created.id, publicationStatus: 'UNPUBLISHED' });
  });

  it('SUBMITTED 항목과 없는 id의 상세는 404 NOT_FOUND problem+json이다', async () => {
    const built = buildLoginApp();
    const submitted = await seedItem(built.catalog, 'SUBMITTED');

    for (const id of [submitted.id, 'no-such-item']) {
      const res = await get(built, `/api/catalog/${id}`);

      expect(res.status).toBe(404);
      expect(res.headers.get('Content-Type')).toContain('application/problem+json');
      expect(((await res.json()) as Problem).code).toBe('NOT_FOUND');
    }
  });
});
