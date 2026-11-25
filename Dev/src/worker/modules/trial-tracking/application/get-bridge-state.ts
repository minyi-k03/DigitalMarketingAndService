import type { KstDate } from '../../../../shared/kst-date';
import type { TrialTrackingDeps } from '../deps';
import type { TrialStatus } from '../infra/trial-repo';
import { loadOwned, type TrialRecordRef } from './trial-command-support';

/** EscapeBridge가 화면 모드를 정하는 데 쓰는 기록 상태 (architecture §3.2). 개인 식별 정보는 없다 */
export interface BridgeState {
  status: TrialStatus;
  /** ExitPoll 응답이 이미 있는지. 있으면 재진입 시 투표를 생략한다 (SPEC §7) */
  hasExitPoll: boolean;
  catalogItemId: string;
  startDate: KstDate;
  billingDate: KstDate;
  bufferApplied: boolean;
}

/** 브릿지용 기록 상태 (SPEC §7, D-09). 남의 기록은 NOT_FOUND다 */
export async function getBridgeState(
  deps: TrialTrackingDeps,
  ref: TrialRecordRef,
): Promise<BridgeState> {
  const record = await loadOwned(deps, ref);
  return {
    status: record.status,
    hasExitPoll: record.exitReason !== undefined,
    catalogItemId: record.catalogItemId,
    startDate: record.startDate,
    billingDate: record.billingDate,
    bufferApplied: record.bufferApplied,
  };
}
