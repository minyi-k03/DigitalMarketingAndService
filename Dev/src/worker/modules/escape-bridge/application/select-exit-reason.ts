import type { components } from '../../../../shared/api-types';
import type { EscapeBridgeDeps } from '../deps';

export type SelectExitReasonResult = components['schemas']['StartCancelAttemptResult'];

export interface SelectExitReasonCommand {
  userId: string;
  trialRecordId: string;
  exitReason: components['schemas']['ExitReason'];
}

/**
 * 브릿지 사유 선택 (SPEC §5, §7 단일 명령, 스토리 20·21·25). `ExitPoll` 응답 저장·`CANCEL_ATTEMPTED` 전이·알림 교체는
 * Trial Tracking의 `startCancelAttempt`가 한 batch로 처리하고, 이 명령은 그 결과(직링크)를 그대로 돌려준다.
 * 직링크는 이 응답과 `REENTRY`·`GUIDE_ONLY` 조회로만 나간다. 이미 사유를 고른 기록(`CANCEL_ATTEMPTED`)은
 * 투표 없이 `getBridgeView`(`REENTRY`)로 직링크를 받으므로 여기서는 `INVALID_TRANSITION`이다.
 */
export function selectExitReason(
  deps: EscapeBridgeDeps,
  cmd: SelectExitReasonCommand,
): Promise<SelectExitReasonResult> {
  return deps.trialTracking.startCancelAttempt(cmd);
}
