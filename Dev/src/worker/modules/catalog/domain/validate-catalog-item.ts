import type { components } from '../../../../shared/api-types';

type CatalogItemInput = components['schemas']['CatalogItemInput'];

/**
 * 검증 대상. 등록 입력에 서버가 정하는 최종 검증일(`lastVerifiedAt`)을 더한 모양이다.
 * 등록 때는 application이 오늘(KST)을 채워 넣고, 수정 때는 기존 항목에 변경분을 합쳐 넘긴다.
 */
export type CatalogItemCandidate = CatalogItemInput & { lastVerifiedAt: string };

export interface CatalogValidationContext {
  /** `app_settings`의 `catalog.allowedDeepLinkSchemes`. 기본값은 `[]` (SPEC §2 G4) */
  allowedDeepLinkSchemes: readonly string[];
}

/** `problem+json`의 `errors[]`와 같은 모양 */
export interface CatalogValidationError {
  field: string;
  message: string;
}

const KST_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ESCAPE_GUIDE_STEPS = 3;

/** 카탈로그 항목의 도메인 규칙(SPEC §2)을 검사한다. 오류가 없으면 빈 배열을 돌려준다 */
export function validateCatalogItemInput(
  item: CatalogItemCandidate,
  context: CatalogValidationContext,
): CatalogValidationError[] {
  const errors: CatalogValidationError[] = [];

  if (item.name.trim() === '') {
    errors.push({ field: 'name', message: '서비스명은 필수입니다' });
  }
  if (!KST_DATE.test(item.lastVerifiedAt)) {
    errors.push({ field: 'lastVerifiedAt', message: '최종 검증일은 YYYY-MM-DD 형식이어야 합니다' });
  }

  if (item.escapeGuideSteps.length < 1 || item.escapeGuideSteps.length > MAX_ESCAPE_GUIDE_STEPS) {
    errors.push({
      field: 'escapeGuideSteps',
      message: `해지 가이드는 1~${MAX_ESCAPE_GUIDE_STEPS}단계로만 저장할 수 있습니다`,
    });
  }

  const isForcedPattern = item.escapePattern === 'PC_OR_APP_FORCED';
  if (isForcedPattern && item.forcedChannel === undefined) {
    errors.push({
      field: 'forcedChannel',
      message: 'PC_OR_APP_FORCED 항목은 강제 접속 채널(APP·PC_WEB)을 골라야 합니다',
    });
  }
  if (!isForcedPattern && item.forcedChannel !== undefined) {
    errors.push({
      field: 'forcedChannel',
      message: 'PC_OR_APP_FORCED가 아닌 항목은 강제 접속 채널을 비워 둬야 합니다',
    });
  }

  if (item.forcedChannel === 'APP' && isBlank(item.escapeLinkFallbackUrl)) {
    errors.push({
      field: 'escapeLinkFallbackUrl',
      message: '전용 앱 해지 항목은 앱 미설치 때 연결할 대체 URL이 필수입니다',
    });
  }

  if (item.kind === 'SPONSORED_TRIAL') {
    if (isBlank(item.signupUrl)) {
      errors.push({ field: 'signupUrl', message: 'SponsoredTrial은 가입 URL이 필수입니다' });
    }
    if (isBlank(item.ownerPartnerId)) {
      errors.push({
        field: 'ownerPartnerId',
        message: 'SponsoredTrial은 소유 파트너가 필수입니다',
      });
    }
  }

  if (isBlank(item.supportContact.email) && isBlank(item.supportContact.url)) {
    errors.push({
      field: 'supportContact',
      message: '고객센터 연락처는 이메일과 문의 페이지 URL 중 하나 이상이 필요합니다',
    });
  }

  const httpsOnlyFields: [field: string, value: string | undefined][] = [
    ['signupUrl', item.signupUrl],
    ['supportContact.url', item.supportContact.url],
    ['eduBenefit.url', item.eduBenefit?.url],
    ['escapeLinkFallbackUrl', item.escapeLinkFallbackUrl],
  ];
  for (const [field, value] of httpsOnlyFields) {
    // 비어 있는 경우의 필수 여부는 위 규칙이 따로 판단한다
    if (!isBlank(value) && !isHttpsUrl(value)) {
      errors.push({ field, message: 'https:// 로 시작하는 URL만 사용할 수 있습니다' });
    }
  }

  if (!isAllowedEscapeLink(item, context.allowedDeepLinkSchemes)) {
    errors.push({
      field: 'escapeLink',
      message: 'https:// URL이거나, 전용 앱 해지 항목(APP)에 한해 등록된 앱 스킴의 링크여야 합니다',
    });
  }

  return errors;
}

function isBlank(value: string | undefined): value is undefined | '' {
  return value === undefined || value.trim() === '';
}

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isHttpsUrl(value: string | undefined): boolean {
  return value !== undefined && parseUrl(value)?.protocol === 'https:';
}

/** 직링크는 https만 허용하고, forcedChannel = APP일 때만 등록된 커스텀 앱 스킴도 허용한다 (G4) */
function isAllowedEscapeLink(
  item: CatalogItemCandidate,
  allowedDeepLinkSchemes: readonly string[],
): boolean {
  const url = parseUrl(item.escapeLink);
  if (url === undefined) return false;
  if (url.protocol === 'https:') return true;
  if (item.forcedChannel !== 'APP') return false;

  return allowedDeepLinkSchemes.some((scheme) => `${normalizeScheme(scheme)}:` === url.protocol);
}

/** 설정값은 `myapp`·`myapp:`·`MyApp` 어느 표기로 와도 같은 스킴으로 비교한다 */
function normalizeScheme(scheme: string): string {
  return scheme.trim().replace(/:$/, '').toLowerCase();
}
