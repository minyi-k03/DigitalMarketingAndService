import type { components } from '../../shared/api-types';

type CatalogItem = components['schemas']['CatalogItem'];
type CatalogItemInput = components['schemas']['CatalogItemInput'];
type CatalogItemPatch = components['schemas']['CatalogItemPatch'];

export type ServiceCategory = components['schemas']['ServiceCategory'];
export type EscapePattern = components['schemas']['EscapePattern'];
export type AccessRetentionPolicy = components['schemas']['AccessRetentionPolicy'];
export type ItemKind = CatalogItem['kind'];

/** 화면 입력값. 숫자 칸은 입력 중인 글자 그대로 두고, 보낼 때 검사해서 숫자로 바꾼다 */
export type ItemForm = {
  /** 등록 화면이 정한다. SPONSORED_TRIAL이면 가입 URL·소유 파트너가 필수다 (SPEC §2, D-17) */
  kind: ItemKind;
  name: string;
  signupUrl: string;
  ownerPartnerId: string;
  serviceCategory: ServiceCategory;
  monthlyPrice: string;
  defaultTrialDays: string;
  isGlobalTimeZoneBufferRequired: boolean;
  menuDepth: 0 | 1 | 2;
  persuasionPopups: 0 | 1 | 2;
  forcedPcOrApp: 0 | 2;
  escapePattern: EscapePattern;
  forcedChannel: '' | 'APP' | 'PC_WEB';
  /** 입력 칸마다 한 단계. 빈 칸은 보낼 때 버린다 */
  escapeGuideSteps: string[];
  escapeLink: string;
  escapeLinkFallbackUrl: string;
  accessRetentionPolicy: AccessRetentionPolicy;
  /** 한 줄에 하나 */
  backupChecklist: string;
  eduDescription: string;
  eduUrl: string;
  supportEmail: string;
  supportUrl: string;
};

/** 칸 이름 → 안내 문구. 서버 오류(`problem+json`의 `errors[]`)도 같은 칸 이름으로 바꿔 보여 준다 */
export type FormErrors = Partial<Record<string, string>>;

export function emptyForm(kind: ItemKind = 'GUARDED_SERVICE'): ItemForm {
  return {
    kind,
    name: '',
    signupUrl: '',
    ownerPartnerId: '',
    serviceCategory: 'OTT',
    monthlyPrice: '',
    defaultTrialDays: '',
    isGlobalTimeZoneBufferRequired: false,
    menuDepth: 0,
    persuasionPopups: 0,
    forcedPcOrApp: 0,
    escapePattern: 'DIRECT_LINK',
    forcedChannel: '',
    escapeGuideSteps: ['', '', ''],
    escapeLink: '',
    escapeLinkFallbackUrl: '',
    accessRetentionPolicy: 'RETAIN_UNTIL_END',
    backupChecklist: '',
    eduDescription: '',
    eduUrl: '',
    supportEmail: '',
    supportUrl: '',
  };
}

export function formFromItem(item: CatalogItem): ItemForm {
  return {
    kind: item.kind,
    name: item.name,
    signupUrl: item.signupUrl ?? '',
    ownerPartnerId: item.ownerPartnerId ?? '',
    serviceCategory: item.serviceCategory,
    monthlyPrice: String(item.monthlyPrice),
    defaultTrialDays: String(item.defaultTrialDays),
    isGlobalTimeZoneBufferRequired: item.isGlobalTimeZoneBufferRequired,
    menuDepth: item.darkPatternScores.menuDepth,
    persuasionPopups: item.darkPatternScores.persuasionPopups,
    forcedPcOrApp: item.darkPatternScores.forcedPcOrApp,
    escapePattern: item.escapePattern,
    forcedChannel: item.forcedChannel ?? '',
    // 가이드는 최대 3단계이고, 빈 칸까지 3칸을 채워 둔다
    escapeGuideSteps: [...item.escapeGuideSteps, '', '', ''].slice(
      0,
      Math.max(3, item.escapeGuideSteps.length),
    ),
    escapeLink: item.escapeLink,
    escapeLinkFallbackUrl: item.escapeLinkFallbackUrl ?? '',
    accessRetentionPolicy: item.accessRetentionPolicy,
    backupChecklist: (item.backupChecklist ?? []).join('\n'),
    eduDescription: item.eduBenefit?.description ?? '',
    eduUrl: item.eduBenefit?.url ?? '',
    supportEmail: item.supportContact.email ?? '',
    supportUrl: item.supportContact.url ?? '',
  };
}

type Normalized =
  { ok: true; input: Omit<CatalogItemInput, 'kind'> } | { ok: false; errors: FormErrors };

const MAX_GUIDE_STEPS = 3;

/** 폼 값을 서버 입력 모양으로 정리한다. 서로 얽힌 도메인 규칙(https 등)은 서버가 다시 검사한다 (SPEC §2) */
function normalize(form: ItemForm): Normalized {
  const errors: FormErrors = {};

  const name = form.name.trim();
  if (name === '') errors.name = '서비스명을 입력해 주세요.';

  const sponsoredTrial = form.kind === 'SPONSORED_TRIAL';
  const signupUrl = form.signupUrl.trim();
  const ownerPartnerId = form.ownerPartnerId.trim();
  if (sponsoredTrial && signupUrl === '') errors.signupUrl = '가입 페이지 URL을 입력해 주세요.';
  if (sponsoredTrial && ownerPartnerId === '') {
    errors.ownerPartnerId = '소유 파트너를 골라 주세요.';
  }

  const priceText = form.monthlyPrice.trim();
  const monthlyPrice = /^\d+$/.test(priceText) ? Number(priceText) : Number.NaN;
  // 안전한 정수 범위를 넘는 값은 서버로 보내기 전에 막는다
  if (!Number.isSafeInteger(monthlyPrice))
    errors.monthlyPrice = '월 가격은 0 이상의 숫자로 입력해 주세요.';

  const daysText = form.defaultTrialDays.trim();
  const defaultTrialDays = /^\d+$/.test(daysText) ? Number(daysText) : Number.NaN;
  if (Number.isNaN(defaultTrialDays) || defaultTrialDays < 1 || defaultTrialDays > 365) {
    errors.defaultTrialDays = '체험 일수는 1~365 사이 숫자로 입력해 주세요.';
  }

  const escapeGuideSteps = form.escapeGuideSteps.map((s) => s.trim()).filter((s) => s !== '');
  if (escapeGuideSteps.length < 1 || escapeGuideSteps.length > MAX_GUIDE_STEPS) {
    errors.escapeGuideSteps = `해지 가이드는 1~${MAX_GUIDE_STEPS}단계로 입력해 주세요.`;
  }

  const escapeLink = form.escapeLink.trim();
  if (escapeLink === '') errors.escapeLink = '해지 링크를 입력해 주세요.';

  const forced = form.escapePattern === 'PC_OR_APP_FORCED';
  const forcedChannel = forced && form.forcedChannel !== '' ? form.forcedChannel : undefined;
  if (forced && forcedChannel === undefined) {
    errors.forcedChannel = '앱 전용인지 PC 웹 전용인지 골라 주세요.';
  }

  const fallbackUrl = form.escapeLinkFallbackUrl.trim();
  if (forcedChannel === 'APP' && fallbackUrl === '') {
    errors.escapeLinkFallbackUrl = '앱이 없을 때 연결할 대체 URL이 필요해요.';
  }

  const email = form.supportEmail.trim();
  const url = form.supportUrl.trim();
  if (email === '' && url === '') {
    errors.supportContact = '고객센터 이메일이나 문의 페이지 URL 중 하나는 입력해 주세요.';
  }

  const eduDescription = form.eduDescription.trim();
  const eduUrl = form.eduUrl.trim();
  if ((eduDescription === '') !== (eduUrl === '')) {
    errors.eduBenefit = '학생 혜택은 설명과 URL을 함께 입력하거나 둘 다 비워 주세요.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const backupChecklist = form.backupChecklist
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');

  return {
    ok: true,
    input: {
      name,
      ...(sponsoredTrial && { signupUrl, ownerPartnerId }),
      serviceCategory: form.serviceCategory,
      monthlyPrice,
      defaultTrialDays,
      isGlobalTimeZoneBufferRequired: form.isGlobalTimeZoneBufferRequired,
      darkPatternScores: {
        menuDepth: form.menuDepth,
        persuasionPopups: form.persuasionPopups,
        forcedPcOrApp: form.forcedPcOrApp,
      },
      escapePattern: form.escapePattern,
      ...(forcedChannel !== undefined && { forcedChannel }),
      escapeGuideSteps,
      escapeLink,
      ...(fallbackUrl !== '' && { escapeLinkFallbackUrl: fallbackUrl }),
      accessRetentionPolicy: form.accessRetentionPolicy,
      ...(backupChecklist.length > 0 && { backupChecklist }),
      ...(eduDescription !== '' && { eduBenefit: { description: eduDescription, url: eduUrl } }),
      supportContact: {
        ...(email !== '' && { email }),
        ...(url !== '' && { url }),
      },
    },
  };
}

export type CreateRequest =
  { ok: true; body: CatalogItemInput } | { ok: false; errors: FormErrors };

/** 등록 본문. kind는 폼이 정한다: 직접 검증한 서비스(GUARDED_SERVICE) 또는 파트너 대리 제출(SPONSORED_TRIAL) */
export function buildCreateRequest(form: ItemForm): CreateRequest {
  const result = normalize(form);
  if (!result.ok) return result;
  return { ok: true, body: { kind: form.kind, ...result.input } };
}

export type UpdateBody = {
  changes: CatalogItemPatch;
  markVerified?: true;
};

export type UpdateRequest =
  | { ok: true; body: UpdateBody }
  | { ok: false; reason: 'NO_CHANGES' }
  | { ok: false; errors: FormErrors };

/** 서버 항목에서 폼이 다루는 필드만 뽑는다. 빈 배열로 저장된 백업 체크리스트는 없는 것과 같다 */
function comparableOf(item: CatalogItem): Omit<CatalogItemInput, 'kind'> {
  return {
    name: item.name,
    ...(item.kind === 'SPONSORED_TRIAL' && {
      signupUrl: item.signupUrl ?? '',
      ownerPartnerId: item.ownerPartnerId ?? '',
    }),
    serviceCategory: item.serviceCategory,
    monthlyPrice: item.monthlyPrice,
    defaultTrialDays: item.defaultTrialDays,
    isGlobalTimeZoneBufferRequired: item.isGlobalTimeZoneBufferRequired,
    darkPatternScores: item.darkPatternScores,
    escapePattern: item.escapePattern,
    ...(item.forcedChannel !== undefined && { forcedChannel: item.forcedChannel }),
    escapeGuideSteps: item.escapeGuideSteps,
    escapeLink: item.escapeLink,
    ...(item.escapeLinkFallbackUrl !== undefined && {
      escapeLinkFallbackUrl: item.escapeLinkFallbackUrl,
    }),
    accessRetentionPolicy: item.accessRetentionPolicy,
    ...(item.backupChecklist !== undefined &&
      item.backupChecklist.length > 0 && { backupChecklist: item.backupChecklist }),
    ...(item.eduBenefit !== undefined && { eduBenefit: item.eduBenefit }),
    supportContact: item.supportContact,
  };
}

/** 키 순서와 상관없이 같은 값인지 비교하기 위한 문자열 */
function canon(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

// 등록 때 선택이던 필드. 지우려면 null을 보낸다 (JSON Merge Patch, openapi CatalogItemPatch)
const CLEARABLE = [
  'forcedChannel',
  'escapeLinkFallbackUrl',
  'backupChecklist',
  'eduBenefit',
] as const;

/**
 * 수정 본문. 바뀐 필드만 `changes`에 담고, 지운 선택 필드는 null로 보낸다.
 * `signupUrl`·`ownerPartnerId`는 SPONSORED_TRIAL 항목에서만 비교한다(둘 다 필수라 지우지 않는다).
 * `markVerified`는 해지 경로를 직접 확인했다는 표시이며 변경이 없어도 보낼 수 있다 (SPEC §2).
 */
export function buildUpdateRequest(
  item: CatalogItem,
  form: ItemForm,
  { markVerified }: { markVerified: boolean },
): UpdateRequest {
  const result = normalize(form);
  if (!result.ok) return result;

  const before = comparableOf(item) as Record<string, unknown>;
  const after = result.input as Record<string, unknown>;
  const changes: Record<string, unknown> = {};

  for (const [field, value] of Object.entries(after)) {
    if (canon(before[field]) !== canon(value)) changes[field] = value;
  }
  for (const field of CLEARABLE) {
    if (before[field] !== undefined && after[field] === undefined) changes[field] = null;
  }

  if (Object.keys(changes).length === 0 && !markVerified) {
    return { ok: false, reason: 'NO_CHANGES' };
  }
  return {
    ok: true,
    body: {
      changes: changes as CatalogItemPatch,
      ...(markVerified && { markVerified: true as const }),
    },
  };
}

/**
 * 서버 필드명(`escapeGuideSteps.1`, `supportContact.email` 등)을 폼 칸 이름으로 바꾼다. 칸마다 첫 메시지만 남긴다.
 * 수정 요청은 본문이 `{ changes }`로 감싸여 있어 형식 검사(zod) 오류가 `changes.` 접두사로 오므로 먼저 벗긴다.
 * 도메인 검증 오류(SPEC §2)는 접두사 없이 온다.
 */
export function mapServerFieldErrors(
  errors: readonly { field: string; message: string }[] | undefined,
): FormErrors {
  const mapped: FormErrors = {};
  for (const { field, message } of errors ?? []) {
    const path = field.startsWith('changes.') ? field.slice('changes.'.length) : field;
    const key = path.split('.')[0] ?? path;
    mapped[key] ??= message;
  }
  return mapped;
}
