import { addDays, parseKstDate, type KstDate } from '../../shared/kst-date';

export type StartDateRejection = 'INVALID' | 'FUTURE' | 'ENDED';

export type TrialPlanPreview =
  | { ok: true; billingDate: KstDate; safeEndDate: KstDate }
  | { ok: false; reason: StartDateRejection };

type PreviewInput = {
  startDate: string;
  trialDays: number;
  /** 글로벌 항목(`isGlobalTimeZoneBufferRequired`)이면 안전 만료일을 하루 앞당긴다 */
  bufferApplied: boolean;
  today: KstDate;
};

/**
 * 등록 화면의 미리보기. 서버(SPEC §3·§4)와 같은 규칙이지만 확정값은 아니며
 * 실제 결제 예정일·안전 만료일은 등록 응답으로 보여 준다.
 */
export function previewTrialPlan({
  startDate,
  trialDays,
  bufferApplied,
  today,
}: PreviewInput): TrialPlanPreview {
  let start: KstDate;
  try {
    start = parseKstDate(startDate);
  } catch {
    return { ok: false, reason: 'INVALID' };
  }
  if (start > today) return { ok: false, reason: 'FUTURE' };

  const billingDate = addDays(start, trialDays);
  if (billingDate < today) return { ok: false, reason: 'ENDED' };

  return {
    ok: true,
    billingDate,
    safeEndDate: bufferApplied ? addDays(billingDate, -1) : billingDate,
  };
}

const START_DATE_MESSAGES: Record<StartDateRejection, string> = {
  INVALID: '시작일을 날짜 형식으로 입력해 주세요.',
  FUTURE: '시작일은 오늘 이후로 정할 수 없어요.',
  ENDED: '이미 끝난 체험이에요. 결제 예정일이 지났어요.',
};

export function startDateMessage(reason: StartDateRejection): string {
  return START_DATE_MESSAGES[reason];
}
