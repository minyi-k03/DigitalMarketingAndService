import type { components } from '../../src/shared/api-types';

export type CatalogItemInput = components['schemas']['CatalogItemInput'];

/** 검증을 모두 통과하는 GUARDED_SERVICE 등록 입력. 필요한 필드만 덮어써서 쓴다 */
export function catalogInput(overrides: Partial<CatalogItemInput> = {}): CatalogItemInput {
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
    ...overrides,
  };
}
