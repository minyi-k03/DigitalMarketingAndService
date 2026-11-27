import type { components } from '../../../../shared/api-types';
import { daysBetween, type KstDate } from '../../../../shared/kst-date';

export type TrialAction = components['schemas']['TrialAction'];
type TrialStatus = components['schemas']['TrialStatus'];

/** 내 체험 목록의 '진행 중' 탭 상태 (SPEC §13) */
export const ACTIVE_STATUSES = [
  'TRACKING',
  'CANCEL_ATTEMPTED',
  'MISSED_BILLED',
] as const satisfies readonly TrialStatus[];

/** 내 체험 목록의 '지난 체험' 탭 상태: 종료 상태 전부 (SPEC §13) */
export const PAST_STATUSES = [
  'CANCELED_CONFIRMED',
  'KEPT',
  'VOIDED',
  'BILLED_CONFIRMED',
] as const satisfies readonly TrialStatus[];

/**
 * D-Day 표기 (SPEC §13). 오늘 < 안전 만료일이면 'D-n', 같으면 'D-Day',
 * 안전 만료일 < 오늘 ≤ 결제 예정일(글로벌 항목의 마지막 하루)이면 '결제 예정일', 그 이후는 표시하지 않는다.
 * 이미 끝났거나 `BillingDate`가 지나 `MISSED_BILLED`가 된 기록에는 의미가 없어 표시하지 않는다.
 */
export function dDayLabel(
  status: TrialStatus,
  today: KstDate,
  safeEndDate: KstDate,
  billingDate: KstDate,
) {
  if (status !== 'TRACKING' && status !== 'CANCEL_ATTEMPTED') return null;
  if (today < safeEndDate) return `D-${daysBetween(today, safeEndDate)}`;
  if (today === safeEndDate) return 'D-Day';
  if (today <= billingDate) return '결제 예정일';
  return null;
}

/** 상태별 행동 버튼 (SPEC §13, D-09). 각 버튼은 전이표가 허용하는 명령과 짝이 맞는다 */
const ACTIONS: Record<TrialStatus, readonly TrialAction[]> = {
  TRACKING: ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
  CANCEL_ATTEMPTED: ['CONFIRM_CANCEL', 'GO_TO_BRIDGE', 'KEEP'],
  MISSED_BILLED: [
    'RESOLVE_BILLED',
    'RESOLVE_CANCELED_BEFORE_BILLING',
    'RESOLVE_KEEP_USING',
    'GO_TO_BRIDGE_GUIDE',
    'VIEW_REFUND_TEMPLATE',
  ],
  BILLED_CONFIRMED: ['GO_TO_BRIDGE_GUIDE', 'VIEW_REFUND_TEMPLATE'],
  CANCELED_CONFIRMED: [],
  KEPT: [],
  VOIDED: [],
};

export function actionsFor(status: TrialStatus): TrialAction[] {
  return [...ACTIONS[status]];
}
