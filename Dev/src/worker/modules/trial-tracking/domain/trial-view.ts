import type { components } from '../../../../shared/api-types';
import { daysBetween, type KstDate } from '../../../../shared/kst-date';

export type TrialAction = components['schemas']['TrialAction'];
type TrialStatus = components['schemas']['TrialStatus'];

/**
 * D-Day 표기 (SPEC §13). 오늘 < 안전 만료일이면 'D-n', 같으면 'D-Day',
 * 안전 만료일 < 오늘 ≤ 결제 예정일(글로벌 항목의 마지막 하루)이면 '결제 예정일', 그 이후는 표시하지 않는다.
 */
export function dDayLabel(today: KstDate, safeEndDate: KstDate, billingDate: KstDate) {
  if (today < safeEndDate) return `D-${daysBetween(today, safeEndDate)}`;
  if (today === safeEndDate) return 'D-Day';
  if (today <= billingDate) return '결제 예정일';
  return null;
}

/**
 * 상태별 행동 버튼 (SPEC §13). 지금은 새로 만든 기록의 상태(TRACKING)만 정의한다.
 * 나머지 상태는 내 체험 목록(T19)에서 채운다.
 */
export function actionsFor(status: TrialStatus): TrialAction[] {
  if (status === 'TRACKING') return ['GO_TO_BRIDGE', 'KEEP', 'VOID'];
  return [];
}
