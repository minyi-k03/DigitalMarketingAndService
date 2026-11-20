import type { components } from '../../../../shared/api-types';
import type { UtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';

type TrialStatus = components['schemas']['TrialStatus'];

/** 상태 머신 이벤트 (SPEC §5, architecture §5.2) */
export type TrialEvent =
  | 'UPDATE_DATES'
  | 'APPLY_BUFFER_CHANGE'
  | 'START_CANCEL_ATTEMPT'
  | 'REENTER_BRIDGE'
  | 'CONFIRM_CANCEL'
  | 'DECIDE_KEEP'
  | 'VOID'
  | 'BILLING_DATE_PASSED'
  | 'RESOLVE_BILLED'
  | 'RESOLVE_CANCELED_BEFORE_BILLING'
  | 'RESOLVE_KEEP_USING';

/** SPEC §5 전이표. 여기에 없는 (상태, 이벤트) 조합은 모두 거부한다 */
const TRANSITIONS: Record<TrialEvent, Partial<Record<TrialStatus, TrialStatus>>> = {
  UPDATE_DATES: { TRACKING: 'TRACKING', CANCEL_ATTEMPTED: 'CANCEL_ATTEMPTED' },
  APPLY_BUFFER_CHANGE: { TRACKING: 'TRACKING', CANCEL_ATTEMPTED: 'CANCEL_ATTEMPTED' },
  START_CANCEL_ATTEMPT: { TRACKING: 'CANCEL_ATTEMPTED' },
  REENTER_BRIDGE: { CANCEL_ATTEMPTED: 'CANCEL_ATTEMPTED' },
  CONFIRM_CANCEL: { TRACKING: 'CANCELED_CONFIRMED', CANCEL_ATTEMPTED: 'CANCELED_CONFIRMED' },
  DECIDE_KEEP: { TRACKING: 'KEPT', CANCEL_ATTEMPTED: 'KEPT' },
  VOID: { TRACKING: 'VOIDED' },
  BILLING_DATE_PASSED: { TRACKING: 'MISSED_BILLED', CANCEL_ATTEMPTED: 'MISSED_BILLED' },
  RESOLVE_BILLED: { MISSED_BILLED: 'BILLED_CONFIRMED' },
  RESOLVE_CANCELED_BEFORE_BILLING: { MISSED_BILLED: 'CANCELED_CONFIRMED' },
  RESOLVE_KEEP_USING: { MISSED_BILLED: 'KEPT' },
};

/** 종료 상태 (SPEC §5). 여기로 전이하면 예약된 알림을 모두 취소한다 (§6) */
const TERMINAL: ReadonlySet<TrialStatus> = new Set([
  'CANCELED_CONFIRMED',
  'KEPT',
  'VOIDED',
  'BILLED_CONFIRMED',
]);

/**
 * 이벤트가 허용되는 출발 상태 (전이표 한 곳이 단일 출처). 배치처럼 상태를 묻지 않고 한꺼번에 전이하는 호출자가
 * 전이표와 따로 목록을 들고 있지 않게 한다.
 */
export function statesAllowing(event: TrialEvent): TrialStatus[] {
  return Object.keys(TRANSITIONS[event]) as TrialStatus[];
}

export interface Transition {
  from: TrialStatus;
  to: TrialStatus;
  /** 상태가 실제로 바뀌면 `now`, 같은 상태로 남으면 기존 값 */
  statusChangedAt: UtcInstant;
  toTerminal: boolean;
}

/**
 * 상태 머신의 단일 진입점 (architecture §5.2). 상태를 바꾸는 모든 명령은 이 함수의 결과로만 저장한다.
 * 표에 없는 전이는 `INVALID_TRANSITION`이다.
 */
export function applyTransition(
  record: { status: TrialStatus; statusChangedAt: UtcInstant },
  event: TrialEvent,
  now: UtcInstant,
): Transition {
  const to = TRANSITIONS[event][record.status];
  if (to === undefined) {
    throw new DomainError(
      'INVALID_TRANSITION',
      `${record.status} 상태에서는 이 작업을 할 수 없습니다`,
    );
  }
  return {
    from: record.status,
    to,
    statusChangedAt: to === record.status ? record.statusChangedAt : now,
    toTerminal: TERMINAL.has(to),
  };
}
