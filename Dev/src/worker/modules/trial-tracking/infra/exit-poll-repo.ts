import type { components } from '../../../../shared/api-types';
import type { UtcInstant } from '../../../../shared/kst-date';
import type { ExitReason, TrialStatus } from './trial-repo';

type ServiceCategory = components['schemas']['ServiceCategory'];

/** SPEC §19 ExitPollResponse. `serviceCategory`는 응답 시점 값의 스냅샷이다 (§7) */
export interface ExitPollResponse {
  trialRecordId: string;
  catalogItemId: string;
  serviceCategory: ServiceCategory;
  reason: ExitReason;
  respondedAt: UtcInstant;
}

/**
 * 응답 INSERT. 같은 batch에서 앞선 조건부 UPDATE가 기록을 `expectedStatus`로 바꿨을 때만 행을 넣는다.
 * UPDATE가 0행(동시 요청에 밀림)이면 응답도 남지 않아 "응답만 있고 전이는 없는" 상태가 생기지 않는다.
 * 기록당 1건은 PRIMARY KEY가 보장하며, 충돌하면 batch 전체가 롤백된다 (architecture §5.3).
 */
export function prepareExitPollInsert(
  db: D1Database,
  response: ExitPollResponse,
  expectedStatus: TrialStatus,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO exit_poll_responses
         (trial_record_id, catalog_item_id, service_category, reason, responded_at)
       SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM trial_records WHERE id = ? AND status = ?)`,
    )
    .bind(
      response.trialRecordId,
      response.catalogItemId,
      response.serviceCategory,
      response.reason,
      response.respondedAt,
      response.trialRecordId,
      expectedStatus,
    );
}
