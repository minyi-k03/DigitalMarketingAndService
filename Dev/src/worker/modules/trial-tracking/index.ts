import {
  createTrialRecord,
  type CreateTrialRecordCommand,
} from './application/create-trial-record';
import type { TrialTrackingDeps } from './deps';

export type { TrialTrackingDeps } from './deps';
export type { CreateTrialRecordCommand } from './application/create-trial-record';
export type { TrialRecordView } from './application/to-trial-record-view';

/** Trial Tracking & Schedule 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createTrialTrackingService(deps: TrialTrackingDeps) {
  return {
    createTrialRecord: (cmd: CreateTrialRecordCommand) => createTrialRecord(deps, cmd),
  };
}

export type TrialTrackingService = ReturnType<typeof createTrialTrackingService>;
