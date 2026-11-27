import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createCatalogService } from '../../src/worker/modules/catalog';
import { catalogInput } from '../support/catalog-fixtures';
import { FakeClock } from '../support/fake-clock';

const operator = { userId: 'operator-1', role: 'OPERATOR' } as const;

function setup() {
  const clock = new FakeClock('2026-11-02T01:00:00.000Z');
  return { clock, catalog: createCatalogService({ db: env.DB, clock }) };
}

describe('CM 파트너 등록·목록 [S35][T61]', () => {
  it('등록하면 서버가 id와 생성 시각을 정해 돌려주고, 목록에서 다시 조회된다', async () => {
    const { catalog } = setup();
    const name = `시연용 파트너 ${crypto.randomUUID()}`;

    const created = await catalog.createPartner({
      companyName: `  ${name}  `,
      contactEmail: 'partner@example.com',
    });

    expect(created).toMatchObject({
      companyName: name,
      contactEmail: 'partner@example.com',
      createdAt: '2026-11-02T01:00:00.000Z',
    });
    expect(created.id).not.toBe('');
    expect(await catalog.listPartners()).toContainEqual(created);
  });

  it('회사명이 비었거나 이메일 형식이 아니면 VALIDATION_FAILED와 필드별 오류를 던지고 저장하지 않는다', async () => {
    const { catalog } = setup();
    const before = (await catalog.listPartners()).length;

    await expect(
      catalog.createPartner({ companyName: '   ', contactEmail: 'not-an-email' }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      extensions: {
        errors: [
          expect.objectContaining({ field: 'companyName' }),
          expect.objectContaining({ field: 'contactEmail' }),
        ],
      },
    });
    expect((await catalog.listPartners()).length).toBe(before);
  });

  it('등록한 파트너는 SPONSORED_TRIAL의 ownerPartnerId로 쓸 수 있다', async () => {
    const { catalog } = setup();
    const partner = await catalog.createPartner({
      companyName: '시연용 파트너',
      contactEmail: 'partner@example.com',
    });

    const item = await catalog.createCatalogItem(
      operator,
      catalogInput({
        kind: 'SPONSORED_TRIAL',
        signupUrl: 'https://partner.example.com/signup',
        ownerPartnerId: partner.id,
      }),
    );

    expect(item).toMatchObject({ ownerPartnerId: partner.id, publicationStatus: 'SUBMITTED' });
  });

  it('이메일 앞뒤 공백은 지우고 저장한다', async () => {
    const { catalog } = setup();

    const created = await catalog.createPartner({
      companyName: '시연용 파트너',
      contactEmail: '  partner@example.com  ',
    });

    expect(created.contactEmail).toBe('partner@example.com');
  });

  it('목록은 회사명 순이고, 이름이 같으면 등록한 순서를 지킨다', async () => {
    const { catalog } = setup();
    const tag = crypto.randomUUID();
    const first = await catalog.createPartner({
      companyName: `${tag}-B`,
      contactEmail: 'b1@example.com',
    });
    const second = await catalog.createPartner({
      companyName: `${tag}-B`,
      contactEmail: 'b2@example.com',
    });
    const earlier = await catalog.createPartner({
      companyName: `${tag}-A`,
      contactEmail: 'a@example.com',
    });

    const ids = (await catalog.listPartners())
      .filter((p) => p.companyName.startsWith(tag))
      .map((p) => p.id);

    expect(ids).toEqual([earlier.id, first.id, second.id]);
  });
});
