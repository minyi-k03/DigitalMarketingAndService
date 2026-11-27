import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import {
  buildCreateRequest,
  buildUpdateRequest,
  emptyForm,
  formFromItem,
  mapServerFieldErrors,
  type ItemForm,
} from '../../src/web/admin/item-form';

type CatalogItem = components['schemas']['CatalogItem'];

/** 서버가 돌려주는 관리용 항목 (GUARDED_SERVICE, 직링크) */
const item: CatalogItem = {
  id: 'item-1',
  kind: 'GUARDED_SERVICE',
  name: 'Netflix',
  serviceCategory: 'OTT',
  monthlyPrice: 17000,
  defaultTrialDays: 30,
  isGlobalTimeZoneBufferRequired: true,
  darkPatternScores: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 },
  darkPatternLevel: 'MEDIUM',
  escapePattern: 'DIRECT_LINK',
  escapeGuideSteps: ['계정 > 멤버십', '멤버십 해지'],
  escapeLink: 'https://www.netflix.com/cancelplan',
  accessRetentionPolicy: 'RETAIN_UNTIL_END',
  supportContact: { url: 'https://help.netflix.com' },
  publicationStatus: 'PUBLISHED',
  lastVerifiedAt: '2026-11-20',
};

/** 화면에서 모두 채운 폼 */
const filled = (patch: Partial<ItemForm> = {}): ItemForm => ({
  ...formFromItem(item),
  ...patch,
});

describe('카탈로그 항목 폼 → 등록 요청 [T30][S38]', () => {
  it('채운 값을 등록 본문으로 바꾼다 (kind는 GUARDED_SERVICE, 선택 필드는 보내지 않는다)', () => {
    expect(buildCreateRequest(filled())).toEqual({
      ok: true,
      body: {
        kind: 'GUARDED_SERVICE',
        name: 'Netflix',
        serviceCategory: 'OTT',
        monthlyPrice: 17000,
        defaultTrialDays: 30,
        isGlobalTimeZoneBufferRequired: true,
        darkPatternScores: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 },
        escapePattern: 'DIRECT_LINK',
        escapeGuideSteps: ['계정 > 멤버십', '멤버십 해지'],
        escapeLink: 'https://www.netflix.com/cancelplan',
        accessRetentionPolicy: 'RETAIN_UNTIL_END',
        supportContact: { url: 'https://help.netflix.com' },
      },
    });
  });

  it('빈 폼은 필수 항목마다 오류를 돌려준다', () => {
    const result = buildCreateRequest(emptyForm());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(
      [
        'defaultTrialDays',
        'escapeGuideSteps',
        'escapeLink',
        'monthlyPrice',
        'name',
        'supportContact',
      ].sort(),
    );
  });

  it('가격은 0 이상의 정수, 체험 일수는 1~365 정수여야 한다', () => {
    const bad = buildCreateRequest(filled({ monthlyPrice: '-1', defaultTrialDays: '366' }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(Object.keys(bad.errors).sort()).toEqual(['defaultTrialDays', 'monthlyPrice']);

    const decimal = buildCreateRequest(filled({ monthlyPrice: '9.5', defaultTrialDays: '0' }));
    expect(decimal.ok).toBe(false);

    // 숫자로 정확히 표현할 수 없는 큰 정수는 서버로 보내지 않는다
    const huge = buildCreateRequest(filled({ monthlyPrice: '9007199254740993' }));
    expect(huge.ok).toBe(false);
    if (!huge.ok) expect(huge.errors.monthlyPrice).toBeDefined();

    const free = buildCreateRequest(filled({ monthlyPrice: '0', defaultTrialDays: '365' }));
    expect(free.ok).toBe(true);
  });

  it('해지 가이드는 빈 줄을 버리고 1~3단계만 받는다', () => {
    const trimmed = buildCreateRequest(filled({ escapeGuideSteps: ['  첫째  ', '', '둘째'] }));
    expect(trimmed.ok && trimmed.body.escapeGuideSteps).toEqual(['첫째', '둘째']);

    const none = buildCreateRequest(filled({ escapeGuideSteps: ['', '  ', ''] }));
    expect(none.ok).toBe(false);

    const tooMany = buildCreateRequest(filled({ escapeGuideSteps: ['a', 'b', 'c', 'd'] }));
    expect(tooMany.ok).toBe(false);
  });

  it('고객센터 연락처는 이메일과 URL 중 하나 이상이 필요하다', () => {
    const none = buildCreateRequest(filled({ supportEmail: '', supportUrl: '' }));
    expect(none.ok).toBe(false);
    if (none.ok) return;
    expect(none.errors.supportContact).toBeDefined();

    const emailOnly = buildCreateRequest(
      filled({ supportEmail: ' help@example.com ', supportUrl: '' }),
    );
    expect(emailOnly.ok && emailOnly.body.supportContact).toEqual({ email: 'help@example.com' });
  });

  it('PC_OR_APP_FORCED는 강제 채널을 골라야 하고, 그 밖의 해지 방식은 채널을 보내지 않는다 (D-15)', () => {
    const missing = buildCreateRequest(filled({ escapePattern: 'PC_OR_APP_FORCED' }));
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.forcedChannel).toBeDefined();

    const pc = buildCreateRequest(
      filled({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' }),
    );
    expect(pc.ok && pc.body.forcedChannel).toBe('PC_WEB');

    // 해지 방식을 바꾼 뒤에도 폼에 남아 있는 채널 값은 버린다
    const stale = buildCreateRequest(
      filled({ escapePattern: 'DIRECT_LINK', forcedChannel: 'APP' }),
    );
    expect(stale.ok && 'forcedChannel' in stale.body).toBe(false);
  });

  it('전용 앱(APP)이면 앱 미설치 대체 URL이 필수다 (D-15)', () => {
    const missing = buildCreateRequest(
      filled({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'APP' }),
    );
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.escapeLinkFallbackUrl).toBeDefined();

    const ok = buildCreateRequest(
      filled({
        escapePattern: 'PC_OR_APP_FORCED',
        forcedChannel: 'APP',
        escapeLinkFallbackUrl: 'https://example.com/web-cancel',
      }),
    );
    expect(ok.ok && ok.body.escapeLinkFallbackUrl).toBe('https://example.com/web-cancel');
  });

  it('백업 체크리스트는 한 줄에 하나씩, 학생 혜택은 설명과 URL을 함께 쓴다', () => {
    const result = buildCreateRequest(
      filled({
        backupChecklist: '프로필 내보내기\n\n  시청 기록 저장 ',
        eduDescription: '학생 50% 할인',
        eduUrl: 'https://example.com/edu',
      }),
    );
    expect(result.ok && result.body.backupChecklist).toEqual(['프로필 내보내기', '시청 기록 저장']);
    expect(result.ok && result.body.eduBenefit).toEqual({
      description: '학생 50% 할인',
      url: 'https://example.com/edu',
    });

    const half = buildCreateRequest(filled({ eduDescription: '학생 50% 할인', eduUrl: '' }));
    expect(half.ok).toBe(false);
    if (half.ok) return;
    expect(half.errors.eduBenefit).toBeDefined();
  });
});

describe('카탈로그 항목 폼 → 수정 요청 [T30][S47]', () => {
  it('아무것도 바꾸지 않았으면 보내지 않는다', () => {
    expect(buildUpdateRequest(item, filled(), { markVerified: false })).toEqual({
      ok: false,
      reason: 'NO_CHANGES',
    });
  });

  it('바뀐 필드만 changes에 담는다', () => {
    expect(
      buildUpdateRequest(item, filled({ monthlyPrice: '19000' }), { markVerified: false }),
    ).toEqual({
      ok: true,
      body: { changes: { monthlyPrice: 19000 } },
    });
  });

  it('가이드·점수 같은 묶음 값은 통째로 보낸다', () => {
    const result = buildUpdateRequest(
      item,
      filled({ escapeGuideSteps: ['계정 > 멤버십', '', '멤버십 해지 > 확인'], menuDepth: 2 }),
      { markVerified: false },
    );
    expect(result).toEqual({
      ok: true,
      body: {
        changes: {
          escapeGuideSteps: ['계정 > 멤버십', '멤버십 해지 > 확인'],
          darkPatternScores: { menuDepth: 2, persuasionPopups: 1, forcedPcOrApp: 0 },
        },
      },
    });
  });

  it('고객센터·학생 혜택의 일부만 바꿔도 객체를 통째로 보낸다 (서버는 얕게 덮어쓴다)', () => {
    const withBenefit: CatalogItem = {
      ...item,
      supportContact: { email: 'help@example.com', url: 'https://help.example.com' },
      eduBenefit: { description: '학생 50% 할인', url: 'https://example.com/edu' },
    };
    const result = buildUpdateRequest(
      withBenefit,
      { ...formFromItem(withBenefit), supportEmail: '', eduUrl: 'https://example.com/edu2' },
      { markVerified: false },
    );
    expect(result).toEqual({
      ok: true,
      body: {
        changes: {
          supportContact: { url: 'https://help.example.com' },
          eduBenefit: { description: '학생 50% 할인', url: 'https://example.com/edu2' },
        },
      },
    });
  });

  it('값을 지운 선택 필드는 null로 보낸다', () => {
    const withOptional: CatalogItem = {
      ...item,
      escapeLinkFallbackUrl: 'https://example.com/web',
      backupChecklist: ['저장'],
      eduBenefit: { description: '할인', url: 'https://example.com/edu' },
    };
    const result = buildUpdateRequest(
      withOptional,
      formFromItem({
        ...withOptional,
        escapeLinkFallbackUrl: undefined,
        backupChecklist: [],
        eduBenefit: undefined,
      }),
      { markVerified: false },
    );
    expect(result).toEqual({
      ok: true,
      body: {
        changes: { escapeLinkFallbackUrl: null, backupChecklist: null, eduBenefit: null },
      },
    });
  });

  it('서버가 빈 배열로 저장한 백업 체크리스트는 변경으로 보지 않는다', () => {
    const emptyList: CatalogItem = { ...item, backupChecklist: [] };
    expect(buildUpdateRequest(emptyList, formFromItem(emptyList), { markVerified: false })).toEqual(
      {
        ok: false,
        reason: 'NO_CHANGES',
      },
    );
  });

  it('해지 방식을 PC_OR_APP_FORCED에서 바꾸면 강제 채널을 지운다', () => {
    const forced: CatalogItem = {
      ...item,
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'PC_WEB',
    };
    const result = buildUpdateRequest(
      forced,
      { ...formFromItem(forced), escapePattern: 'DIRECT_LINK' },
      {
        markVerified: false,
      },
    );
    expect(result).toEqual({
      ok: true,
      body: { changes: { escapePattern: 'DIRECT_LINK', forcedChannel: null } },
    });
  });

  it('등록 화면이 다루지 않는 필드(signupUrl·ownerPartnerId)는 건드리지 않는다', () => {
    const sponsored: CatalogItem = {
      ...item,
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://example.com/signup',
      ownerPartnerId: 'partner-1',
    };
    expect(buildUpdateRequest(sponsored, formFromItem(sponsored), { markVerified: false })).toEqual(
      {
        ok: false,
        reason: 'NO_CHANGES',
      },
    );
  });

  it('경로를 직접 확인했다고 표시하면 변경이 없어도 보낸다', () => {
    expect(buildUpdateRequest(item, filled(), { markVerified: true })).toEqual({
      ok: true,
      body: { changes: {}, markVerified: true },
    });
    expect(
      buildUpdateRequest(item, filled({ monthlyPrice: '19000' }), { markVerified: true }),
    ).toEqual({
      ok: true,
      body: { changes: { monthlyPrice: 19000 }, markVerified: true },
    });
  });

  it('잘못된 입력은 변경 여부와 관계없이 필드별 오류로 막는다', () => {
    const result = buildUpdateRequest(item, filled({ name: '  ' }), { markVerified: false });
    expect(result.ok).toBe(false);
    if (result.ok || !('errors' in result)) return;
    expect(result.errors.name).toBeDefined();
  });
});

describe('서버 검증 오류 → 폼 필드 [T30]', () => {
  it('서버 필드명을 폼 칸에 대응시키고 칸마다 첫 메시지만 남긴다', () => {
    expect(
      mapServerFieldErrors([
        { field: 'escapeGuideSteps.1', message: '비어 있음' },
        { field: 'escapeGuideSteps', message: '단계 수 오류' },
        { field: 'supportContact.email', message: '이메일 형식' },
        { field: 'eduBenefit.url', message: 'https만' },
        { field: 'darkPatternScores.menuDepth', message: '0~2' },
        { field: 'escapeLink', message: 'https만' },
      ]),
    ).toEqual({
      escapeGuideSteps: '비어 있음',
      supportContact: '이메일 형식',
      eduBenefit: 'https만',
      darkPatternScores: '0~2',
      escapeLink: 'https만',
    });
  });

  it('수정 요청의 zod 오류는 `changes.` 접두사를 벗기고 대응시킨다 (PATCH 본문이 { changes }로 감싸여 있다)', () => {
    expect(
      mapServerFieldErrors([
        { field: 'changes.monthlyPrice', message: '0 이상' },
        { field: 'changes.escapeGuideSteps.1', message: '비어 있음' },
        { field: 'changes.supportContact.email', message: '이메일 형식' },
        { field: 'changes.eduBenefit.url', message: 'https만' },
        // 도메인 검증 오류는 접두사 없이 온다
        { field: 'escapeLink', message: 'https만' },
      ]),
    ).toEqual({
      monthlyPrice: '0 이상',
      escapeGuideSteps: '비어 있음',
      supportContact: '이메일 형식',
      eduBenefit: 'https만',
      escapeLink: 'https만',
    });
  });

  it('오류가 없으면 빈 객체다', () => {
    expect(mapServerFieldErrors(undefined)).toEqual({});
  });
});

/** 파트너가 제출한 SponsoredTrial 항목 */
const sponsored: CatalogItem = {
  ...item,
  id: 'item-2',
  kind: 'SPONSORED_TRIAL',
  name: '시연용 체험',
  signupUrl: 'https://partner.example.com/signup',
  ownerPartnerId: 'partner-1',
  publicationStatus: 'SUBMITTED',
};

describe('SponsoredTrial 대리 제출 폼 [T61][S35]', () => {
  const sponsoredForm = (patch: Partial<ItemForm> = {}): ItemForm => ({
    ...formFromItem(sponsored),
    ...patch,
  });

  it('kind를 SPONSORED_TRIAL로 두면 가입 URL과 소유 파트너를 본문에 담는다', () => {
    const result = buildCreateRequest(
      sponsoredForm({
        signupUrl: ' https://partner.example.com/signup ',
        ownerPartnerId: 'partner-1',
      }),
    );

    expect(result.ok && result.body).toMatchObject({
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://partner.example.com/signup',
      ownerPartnerId: 'partner-1',
    });
  });

  it('가입 URL이나 소유 파트너가 비면 칸별 오류를 돌려준다 (D-17, SPEC §2)', () => {
    const result = buildCreateRequest(sponsoredForm({ signupUrl: '  ', ownerPartnerId: '' }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(['ownerPartnerId', 'signupUrl']);
  });

  it('직접 검증한 서비스(GUARDED_SERVICE)에는 가입 URL·파트너를 보내지 않는다', () => {
    const result = buildCreateRequest(
      filled({ signupUrl: 'https://leftover.example.com', ownerPartnerId: 'partner-1' }),
    );

    expect(result.ok && result.body).not.toHaveProperty('signupUrl');
    expect(result.ok && result.body).not.toHaveProperty('ownerPartnerId');
  });

  it('기존 항목에서 폼을 만들면 가입 URL·소유 파트너가 채워진다', () => {
    expect(formFromItem(sponsored)).toMatchObject({
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://partner.example.com/signup',
      ownerPartnerId: 'partner-1',
    });
    expect(formFromItem(item)).toMatchObject({
      kind: 'GUARDED_SERVICE',
      signupUrl: '',
      ownerPartnerId: '',
    });
  });

  it('수정할 때 바뀐 가입 URL·소유 파트너만 changes에 담고, 그대로면 변경 없음이다', () => {
    const unchanged = buildUpdateRequest(sponsored, sponsoredForm(), { markVerified: false });
    expect(unchanged).toEqual({ ok: false, reason: 'NO_CHANGES' });

    const changed = buildUpdateRequest(
      sponsored,
      sponsoredForm({ signupUrl: 'https://partner.example.com/new', ownerPartnerId: 'partner-2' }),
      { markVerified: false },
    );
    expect(changed.ok && changed.body.changes).toEqual({
      signupUrl: 'https://partner.example.com/new',
      ownerPartnerId: 'partner-2',
    });
  });

  it('GUARDED_SERVICE 수정은 가입 URL·파트너를 건드리지 않는다', () => {
    const result = buildUpdateRequest(
      item,
      filled({ name: 'Netflix 2', signupUrl: 'https://x.example.com', ownerPartnerId: 'p' }),
      { markVerified: false },
    );
    expect(result.ok && result.body.changes).toEqual({ name: 'Netflix 2' });
  });

  it('파트너 체험 수정에서 가입 URL·소유 파트너를 비우면 null로 지우지 않고 칸별 오류를 돌려준다', () => {
    const result = buildUpdateRequest(
      sponsored,
      sponsoredForm({ signupUrl: '', ownerPartnerId: '' }),
      { markVerified: false },
    );

    expect(result.ok).toBe(false);
    if (result.ok || !('errors' in result)) return;
    expect(Object.keys(result.errors).sort()).toEqual(['ownerPartnerId', 'signupUrl']);
  });
});
