import { describe, expect, it } from 'vitest';
import { computeDarkPatternLevel } from '../../src/worker/modules/catalog/domain/dark-pattern';
import {
  validateCatalogItemInput,
  type CatalogItemCandidate,
} from '../../src/worker/modules/catalog/domain/validate-catalog-item';

/** 모든 규칙을 통과하는 기준 입력. 각 테스트는 규칙 하나만 어긋나게 덮어쓴다 */
function validItem(overrides: Partial<CatalogItemCandidate> = {}): CatalogItemCandidate {
  return {
    kind: 'GUARDED_SERVICE',
    name: '시연용 OTT',
    serviceCategory: 'OTT',
    monthlyPrice: 9900,
    defaultTrialDays: 30,
    isGlobalTimeZoneBufferRequired: true,
    darkPatternScores: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 },
    escapePattern: 'DIRECT_LINK',
    escapeGuideSteps: ['설정에서 멤버십을 연다', '해지를 누른다'],
    escapeLink: 'https://example.com/cancel',
    accessRetentionPolicy: 'RETAIN_UNTIL_END',
    supportContact: { email: 'help@example.com' },
    lastVerifiedAt: '2026-11-03',
    ...overrides,
  };
}

const noDeepLinks = { allowedDeepLinkSchemes: [] as string[] };

/** 오류가 난 필드 이름만 뽑아 비교한다. 문구가 바뀌어도 테스트가 깨지지 않게 한다 */
function errorFields(candidate: CatalogItemCandidate, allowed = noDeepLinks): string[] {
  return validateCatalogItemInput(candidate, allowed).map((e) => e.field);
}

describe('CM 카탈로그 입력 검증 [S4][S18][S24][S38]', () => {
  it('모든 규칙을 지킨 입력은 오류가 없다', () => {
    expect(validateCatalogItemInput(validItem(), noDeepLinks)).toEqual([]);
  });

  it('name과 lastVerifiedAt은 필수다', () => {
    expect(errorFields(validItem({ name: '   ' }))).toEqual(['name']);
    expect(errorFields(validItem({ lastVerifiedAt: '' }))).toEqual(['lastVerifiedAt']);
    expect(errorFields(validItem({ lastVerifiedAt: '2026/11/03' }))).toEqual(['lastVerifiedAt']);
  });
});

describe('CM EscapeGuide 단계 수 [S18]', () => {
  it('1~3단계는 허용하고 0단계와 4단계 이상은 거부한다', () => {
    expect(errorFields(validItem({ escapeGuideSteps: ['한 단계'] }))).toEqual([]);
    expect(errorFields(validItem({ escapeGuideSteps: ['1', '2', '3'] }))).toEqual([]);

    expect(errorFields(validItem({ escapeGuideSteps: [] }))).toEqual(['escapeGuideSteps']);
    expect(errorFields(validItem({ escapeGuideSteps: ['1', '2', '3', '4'] }))).toEqual([
      'escapeGuideSteps',
    ]);
  });
});

describe('CM forcedChannel 규칙 [S24]', () => {
  const forcedPc = { escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' } as const;

  it('PC_OR_APP_FORCED는 forcedChannel이 필수다', () => {
    expect(errorFields(validItem(forcedPc))).toEqual([]);
    expect(errorFields(validItem({ escapePattern: 'PC_OR_APP_FORCED' }))).toEqual([
      'forcedChannel',
    ]);
  });

  it('그 밖의 EscapePattern에서는 forcedChannel을 비워 둬야 한다', () => {
    expect(
      errorFields(validItem({ escapePattern: 'DIRECT_LINK', forcedChannel: 'PC_WEB' })),
    ).toEqual(['forcedChannel']);
    expect(
      errorFields(validItem({ escapePattern: 'SPA_MODAL_GUIDE', forcedChannel: 'PC_WEB' })),
    ).toEqual(['forcedChannel']);
  });
});

describe('CM 대체 URL·SponsoredTrial 필수 필드 [S24][S38]', () => {
  const forcedApp = { escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'APP' } as const;

  it('forcedChannel이 APP이면 escapeLinkFallbackUrl이 필수다', () => {
    expect(
      errorFields(
        validItem({ ...forcedApp, escapeLinkFallbackUrl: 'https://apps.example.com/app' }),
      ),
    ).toEqual([]);
    expect(errorFields(validItem(forcedApp))).toEqual(['escapeLinkFallbackUrl']);
  });

  it('forcedChannel이 PC_WEB이면 escapeLinkFallbackUrl 없이도 된다', () => {
    expect(
      errorFields(validItem({ escapePattern: 'PC_OR_APP_FORCED', forcedChannel: 'PC_WEB' })),
    ).toEqual([]);
  });

  it('SPONSORED_TRIAL은 signupUrl과 ownerPartnerId가 필수다', () => {
    const sponsored = {
      kind: 'SPONSORED_TRIAL',
      signupUrl: 'https://partner.example.com/signup',
      ownerPartnerId: 'partner-1',
    } as const;

    expect(errorFields(validItem(sponsored))).toEqual([]);
    expect(errorFields(validItem({ ...sponsored, signupUrl: undefined }))).toEqual(['signupUrl']);
    expect(errorFields(validItem({ ...sponsored, ownerPartnerId: undefined }))).toEqual([
      'ownerPartnerId',
    ]);
  });

  it('GUARDED_SERVICE는 signupUrl과 ownerPartnerId 없이도 된다', () => {
    expect(errorFields(validItem({ kind: 'GUARDED_SERVICE' }))).toEqual([]);
  });
});

describe('CM supportContact [S38]', () => {
  it('email과 url 중 하나 이상 있어야 한다', () => {
    expect(errorFields(validItem({ supportContact: { email: 'a@example.com' } }))).toEqual([]);
    expect(errorFields(validItem({ supportContact: { url: 'https://example.com/help' } }))).toEqual(
      [],
    );
    expect(errorFields(validItem({ supportContact: {} }))).toEqual(['supportContact']);
    expect(errorFields(validItem({ supportContact: { email: '  ', url: '' } }))).toEqual([
      'supportContact',
    ]);
  });
});

describe('CM URL 스킴 검증 [G4][S38]', () => {
  it('signupUrl·supportContact.url·eduBenefit.url·escapeLinkFallbackUrl은 https만 허용한다', () => {
    const forcedApp = {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://apps.example.com/app',
    } as const;
    const eduBenefit = { description: '학생 할인', url: 'https://example.com/edu' };

    expect(errorFields(validItem({ signupUrl: 'http://example.com/signup' }))).toEqual([
      'signupUrl',
    ]);
    expect(errorFields(validItem({ supportContact: { url: 'http://example.com/help' } }))).toEqual([
      'supportContact.url',
    ]);
    expect(
      errorFields(validItem({ eduBenefit: { ...eduBenefit, url: 'ftp://example.com' } })),
    ).toEqual(['eduBenefit.url']);
    expect(
      errorFields(validItem({ ...forcedApp, escapeLinkFallbackUrl: 'http://apps.example.com' })),
    ).toEqual(['escapeLinkFallbackUrl']);
    expect(errorFields(validItem({ signupUrl: 'https://example.com/signup', eduBenefit }))).toEqual(
      [],
    );
  });

  it('URL이 아닌 문자열과 javascript: 같은 위험 스킴은 거부한다', () => {
    expect(errorFields(validItem({ signupUrl: 'not a url' }))).toEqual(['signupUrl']);
    expect(errorFields(validItem({ signupUrl: 'javascript:alert(1)' }))).toEqual(['signupUrl']);
    expect(errorFields(validItem({ escapeLink: 'javascript:alert(1)' }))).toEqual(['escapeLink']);
  });

  it('escapeLink는 기본적으로 https만 허용한다', () => {
    expect(errorFields(validItem({ escapeLink: 'http://example.com/cancel' }))).toEqual([
      'escapeLink',
    ]);
    expect(errorFields(validItem({ escapeLink: 'myapp://cancel' }))).toEqual(['escapeLink']);
  });

  describe('escapeLink 커스텀 스킴은 forcedChannel = APP이고 등록된 스킴일 때만 허용한다', () => {
    const forcedApp = {
      escapePattern: 'PC_OR_APP_FORCED',
      forcedChannel: 'APP',
      escapeLinkFallbackUrl: 'https://apps.example.com/app',
      escapeLink: 'myapp://cancel',
    } as const;
    const registered = { allowedDeepLinkSchemes: ['myapp'] };

    it('등록된 스킴이면 허용한다 (콜론 표기 차이와 대소문자는 무시)', () => {
      expect(errorFields(validItem(forcedApp), registered)).toEqual([]);
      expect(errorFields(validItem(forcedApp), { allowedDeepLinkSchemes: ['MyApp:'] })).toEqual([]);
    });

    it('기본값 []에서는 거부한다', () => {
      expect(errorFields(validItem(forcedApp))).toEqual(['escapeLink']);
    });

    it('등록되지 않은 스킴은 거부한다', () => {
      expect(
        errorFields(validItem({ ...forcedApp, escapeLink: 'otherapp://cancel' }), registered),
      ).toEqual(['escapeLink']);
    });

    it('forcedChannel이 APP이 아니면 등록된 스킴도 거부한다', () => {
      expect(
        errorFields(
          validItem({
            escapePattern: 'PC_OR_APP_FORCED',
            forcedChannel: 'PC_WEB',
            escapeLink: 'myapp://cancel',
          }),
          registered,
        ),
      ).toEqual(['escapeLink']);
      expect(errorFields(validItem({ escapeLink: 'myapp://cancel' }), registered)).toEqual([
        'escapeLink',
      ]);
    });
  });
});

describe('CM 다크패턴 등급 계산 [S39]', () => {
  const defaultRubric = { mediumMin: 2, highMin: 4 };

  it.each([
    { scores: { menuDepth: 0, persuasionPopups: 0, forcedPcOrApp: 0 }, level: 'LOW' }, // 합 0
    { scores: { menuDepth: 1, persuasionPopups: 0, forcedPcOrApp: 0 }, level: 'LOW' }, // 합 1
    { scores: { menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 }, level: 'MEDIUM' }, // 합 2
    { scores: { menuDepth: 2, persuasionPopups: 1, forcedPcOrApp: 0 }, level: 'MEDIUM' }, // 합 3
    { scores: { menuDepth: 2, persuasionPopups: 0, forcedPcOrApp: 2 }, level: 'HIGH' }, // 합 4
    { scores: { menuDepth: 2, persuasionPopups: 2, forcedPcOrApp: 2 }, level: 'HIGH' }, // 합 6
  ] as const)('원점수 합 경계: $scores → $level', ({ scores, level }) => {
    expect(computeDarkPatternLevel(scores, defaultRubric)).toBe(level);
  });

  it('기준표 경계값을 주입하면 같은 원점수도 다른 등급이 된다', () => {
    const strict = { mediumMin: 3, highMin: 5 };

    expect(
      computeDarkPatternLevel({ menuDepth: 1, persuasionPopups: 1, forcedPcOrApp: 0 }, strict),
    ).toBe('LOW'); // 합 2: 기본 기준표에서는 MEDIUM
    expect(
      computeDarkPatternLevel({ menuDepth: 2, persuasionPopups: 0, forcedPcOrApp: 2 }, strict),
    ).toBe('MEDIUM'); // 합 4: 기본 기준표에서는 HIGH
  });
});
