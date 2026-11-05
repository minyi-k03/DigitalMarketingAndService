import { parseKstDate, type KstDate } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';

const MIN_TRIAL_DAYS = 1;
const MAX_TRIAL_DAYS = 365;

interface TrialInput {
  startDate: string;
  trialDays: number;
  source: string;
  today: KstDate;
}

/**
 * 새 기록은 PUBLISHED 항목에만 만들 수 있다 (SPEC §3, D-13).
 * 게시 중단(UNPUBLISHED)은 화면에 보이므로 422로 알리고, 공개된 적 없는 SUBMITTED·REJECTED는
 * 공개 상세(T10)처럼 없는 항목과 똑같이 NOT_FOUND로 숨긴다.
 */
export function assertRegistrable(publicationStatus: string): void {
  if (publicationStatus === 'PUBLISHED') return;
  if (publicationStatus === 'UNPUBLISHED') {
    throw new DomainError(
      'CATALOG_ITEM_NOT_PUBLISHED',
      '게시가 중단된 항목은 새로 등록할 수 없습니다',
    );
  }
  throw new DomainError('NOT_FOUND', '카탈로그 항목을 찾을 수 없습니다');
}

/** 계산된 결제 예정일이 오늘보다 이전이면 이미 끝난 체험이다. 오늘 당일은 아직 등록할 수 있다 (SPEC §3) */
export function assertNotEnded(billingDate: KstDate, today: KstDate): void {
  if (billingDate < today) {
    throw new DomainError('TRIAL_ALREADY_ENDED', '이미 끝난 체험은 등록할 수 없습니다');
  }
}

/**
 * 기록 생성 입력 검증 (SPEC §3, architecture §5.1). 날짜는 `YYYY-MM-DD`라 문자열 비교가 날짜순이다.
 * 위반한 필드를 모두 모아 VALIDATION_FAILED로 던진다.
 */
export function validateTrialInput({ startDate, trialDays, source, today }: TrialInput): {
  startDate: KstDate;
  trialDays: number;
} {
  const errors: { field: string; message: string }[] = [];

  let parsed: KstDate | undefined;
  try {
    parsed = parseKstDate(startDate);
  } catch {
    errors.push({
      field: 'startDate',
      message: '실제로 있는 날짜를 YYYY-MM-DD 형식으로 입력해야 합니다',
    });
  }
  if (parsed !== undefined && parsed > today) {
    errors.push({ field: 'startDate', message: '오늘(KST) 이후의 날짜는 입력할 수 없습니다' });
  }
  if (!Number.isInteger(trialDays) || trialDays < MIN_TRIAL_DAYS || trialDays > MAX_TRIAL_DAYS) {
    errors.push({
      field: 'trialDays',
      message: `${MIN_TRIAL_DAYS} 이상 ${MAX_TRIAL_DAYS} 이하의 정수여야 합니다`,
    });
  }

  // 발표 범위(P0)에서는 카탈로그 선택 등록만 허용한다. SPONSORED_OUTBOUND_PROMPT는 P1(T43)이다
  if (source !== 'MANUAL_CATALOG_SELECT') {
    errors.push({ field: 'source', message: 'MANUAL_CATALOG_SELECT만 허용합니다' });
  }

  if (errors.length > 0 || parsed === undefined) {
    throw new DomainError('VALIDATION_FAILED', '체험 기록 입력이 올바르지 않습니다', { errors });
  }
  return { startDate: parsed, trialDays };
}
