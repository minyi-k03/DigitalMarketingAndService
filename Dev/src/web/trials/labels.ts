import type { components } from '../../shared/api-types';

export type TrialStatus = components['schemas']['TrialStatus'];
export type ExitReason = components['schemas']['ExitReason'];

type BadgeTone = 'plain' | 'warn';

const STATUS_BADGES: Record<TrialStatus, { text: string; tone: BadgeTone }> = {
  TRACKING: { text: '추적 중', tone: 'plain' },
  CANCEL_ATTEMPTED: { text: '해지 진행 중', tone: 'plain' },
  MISSED_BILLED: { text: '결제 확인 필요', tone: 'warn' },
  CANCELED_CONFIRMED: { text: '해지 완료', tone: 'plain' },
  KEPT: { text: '계속 이용', tone: 'plain' },
  VOIDED: { text: '등록 취소', tone: 'plain' },
  BILLED_CONFIRMED: { text: '결제됨', tone: 'plain' },
};

/** 상태 배지. 색뿐 아니라 글자로도 구분하고, 사용자의 응답이 필요한 상태만 경고 톤이다 (SPEC §13) */
export function statusBadge(status: TrialStatus) {
  return STATUS_BADGES[status];
}

/** ExitPoll 사유. SPEC §19의 순서 그대로 보여 준다 */
export const EXIT_REASONS = [
  'PRICE_BURDEN',
  'LACK_OF_FEATURES',
  'COMPLEX_UX',
  'SHORT_TERM_GOAL_MET',
  'MOVED_TO_ALTERNATIVE',
] as const satisfies readonly ExitReason[];

const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  PRICE_BURDEN: '가격 부담',
  LACK_OF_FEATURES: '기능·성능 부족',
  COMPLEX_UX: '사용성·UI 복잡',
  SHORT_TERM_GOAL_MET: '단기 목적 달성',
  MOVED_TO_ALTERNATIVE: '대체 서비스 이동',
};

export function exitReasonLabel(reason: ExitReason): string {
  return EXIT_REASON_LABELS[reason];
}
