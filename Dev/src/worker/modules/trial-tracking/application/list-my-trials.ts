import { todayKst } from '../../../../shared/kst-date';
import type { TrackingTerms } from '../../catalog';
import type { TrialTrackingDeps } from '../deps';
import { listOwnedRecords, type TrialTab } from '../infra/trial-repo';
import { toTrialRecordView, type TrialRecordView } from './to-trial-record-view';

export interface ListMyTrialsQuery {
  userId: string;
  tab: TrialTab;
}

export interface MyTrialsView {
  items: TrialRecordView[];
  /** 본인 기록 전체의 `savedAmount` 합계(원). 탭과 무관하다 */
  savedAmountTotal: number;
  /** 진행 중(`TRACKING`·`CANCEL_ATTEMPTED`·`MISSED_BILLED`) 건수. 탭과 무관하다 */
  activeCount: number;
}

/** 내 체험 목록 (SPEC §13, 스토리 41). 본인 기록만 읽는다 */
export async function listMyTrials(
  deps: TrialTrackingDeps,
  query: ListMyTrialsQuery,
): Promise<MyTrialsView> {
  const { records, savedAmountTotal, activeCount } = await listOwnedRecords(
    deps.db,
    query.userId,
    query.tab,
  );
  const today = todayKst(deps.clock);

  // 같은 항목의 기록이 여럿이어도 카탈로그 조회는 항목마다 한 번이다
  const termsById = new Map<string, Promise<TrackingTerms>>();
  const termsOf = (catalogItemId: string) => {
    let terms = termsById.get(catalogItemId);
    if (terms === undefined) {
      terms = deps.catalog.getTrackingTerms(catalogItemId);
      termsById.set(catalogItemId, terms);
    }
    return terms;
  };
  const items = await Promise.all(
    records.map(async (record) =>
      toTrialRecordView(record, await termsOf(record.catalogItemId), today),
    ),
  );
  return { items, savedAmountTotal, activeCount };
}
