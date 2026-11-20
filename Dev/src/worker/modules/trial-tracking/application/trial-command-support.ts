import { DomainError } from '../../../platform/errors';
import type { TrialTrackingDeps } from '../deps';
import { findOwnedRecord, type TrialRecord } from '../infra/trial-repo';

/** 기록을 가리키는 명령 입력. 소유 확인은 명령이 `userId`로 한다 */
export interface TrialRecordRef {
  userId: string;
  trialRecordId: string;
}

/** 본인 기록만 돌려준다. 남의 기록은 없는 기록과 똑같이 NOT_FOUND다 (AGENTS §6) */
export async function loadOwned(
  deps: TrialTrackingDeps,
  ref: TrialRecordRef,
): Promise<TrialRecord> {
  const record = await findOwnedRecord(deps.db, ref.userId, ref.trialRecordId);
  if (record === undefined) throw new DomainError('NOT_FOUND', '체험 기록을 찾을 수 없습니다');
  return record;
}

export function conflict() {
  return new DomainError('CONFLICT', '기록 상태가 바뀌었습니다. 새로 고친 뒤 다시 시도해 주세요');
}

/** D1 batch를 실행한다. 제약 위반(동시 요청이 먼저 넣은 행)은 batch가 통째로 롤백된 CONFLICT로 바꾼다 */
export async function runBatch(db: D1Database, statements: D1PreparedStatement[]) {
  try {
    return await db.batch(statements);
  } catch (e) {
    if (e instanceof Error && e.message.includes('constraint failed')) throw conflict();
    throw e;
  }
}
