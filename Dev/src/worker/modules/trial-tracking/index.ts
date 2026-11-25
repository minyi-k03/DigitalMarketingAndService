import {
  createTrialRecord,
  type CreateTrialRecordCommand,
} from './application/create-trial-record';
import {
  confirmCancel,
  type ConfirmCancelCommand,
  decideKeep,
  getTrialRecord,
  resolveMissedBilling,
  type ResolveMissedBillingCommand,
  startCancelAttempt,
  type StartCancelAttemptCommand,
  type TrialRecordRef,
  voidTrialRecord,
} from './application/trial-state-commands';
import { dispatchDueNotifications, type DispatchCommand } from './application/dispatch';
import { getBridgeState } from './application/get-bridge-state';
import { listMyTrials, type ListMyTrialsQuery } from './application/list-my-trials';
import { runMissedBilledBatch } from './application/missed-billed-batch';
import {
  updateTrialRecord,
  type UpdateTrialRecordCommand,
} from './application/update-trial-record';
import type { TrialTrackingDeps } from './deps';

export type { TrialTrackingDeps } from './deps';
export type { DispatchCommand, DispatchResult } from './application/dispatch';
export type { MissedBilledBatchResult } from './application/missed-billed-batch';
export type { UpdateTrialRecordCommand } from './application/update-trial-record';
export type { CreateTrialRecordCommand } from './application/create-trial-record';
export type {
  ConfirmCancelCommand,
  ResolveMissedBillingCommand,
  StartCancelAttemptCommand,
  StartCancelAttemptResult,
  TrialRecordRef,
} from './application/trial-state-commands';
export type { BridgeState } from './application/get-bridge-state';
export type { ListMyTrialsQuery, MyTrialsView } from './application/list-my-trials';
export type { TrialRecordView } from './application/to-trial-record-view';

/** Trial Tracking & Schedule 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createTrialTrackingService(deps: TrialTrackingDeps) {
  return {
    createTrialRecord: (cmd: CreateTrialRecordCommand) => createTrialRecord(deps, cmd),
    startCancelAttempt: (cmd: StartCancelAttemptCommand) => startCancelAttempt(deps, cmd),
    confirmCancel: (cmd: ConfirmCancelCommand) => confirmCancel(deps, cmd),
    decideKeep: (ref: TrialRecordRef) => decideKeep(deps, ref),
    voidTrialRecord: (ref: TrialRecordRef) => voidTrialRecord(deps, ref),
    resolveMissedBilling: (cmd: ResolveMissedBillingCommand) => resolveMissedBilling(deps, cmd),
    getTrialRecord: (ref: TrialRecordRef) => getTrialRecord(deps, ref),
    getBridgeState: (ref: TrialRecordRef) => getBridgeState(deps, ref),
    listMyTrials: (query: ListMyTrialsQuery) => listMyTrials(deps, query),
    updateTrialRecord: (cmd: UpdateTrialRecordCommand) => updateTrialRecord(deps, cmd),
    dispatchDueNotifications: (cmd?: DispatchCommand) => dispatchDueNotifications(deps, cmd),
    runMissedBilledBatch: () => runMissedBilledBatch(deps),
  };
}

export type TrialTrackingService = ReturnType<typeof createTrialTrackingService>;
