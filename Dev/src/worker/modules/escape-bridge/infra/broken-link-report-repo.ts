import type { UtcInstant } from '../../../../shared/kst-date';
import type {
  BrokenLinkReport,
  BrokenLinkReportFilter,
  BrokenLinkReportStatus,
  BrokenLinkTarget,
  ResolvedStatus,
} from '../domain/broken-link-report';

interface Row {
  id: string;
  user_id: string;
  catalog_item_id: string;
  trial_record_id: string;
  target: BrokenLinkTarget;
  status: BrokenLinkReportStatus;
  created_at: UtcInstant;
  resolved_at: UtcInstant | null;
}

const COLUMNS =
  'id, user_id, catalog_item_id, trial_record_id, target, status, created_at, resolved_at';

function toReport(row: Row): BrokenLinkReport {
  return {
    id: row.id,
    userId: row.user_id,
    catalogItemId: row.catalog_item_id,
    trialRecordId: row.trial_record_id,
    target: row.target,
    status: row.status,
    createdAt: row.created_at,
    // 처리 전에는 resolvedAt 키 자체를 두지 않는다 (openapi 선택 필드)
    ...(row.resolved_at === null ? {} : { resolvedAt: row.resolved_at }),
  };
}

export interface NewReport {
  id: string;
  userId: string;
  catalogItemId: string;
  trialRecordId: string;
  target: BrokenLinkTarget;
  createdAt: UtcInstant;
}

/**
 * 24시간(`cutoff` 초과) 안에 같은 제보가 없을 때만 넣는다. 확인과 삽입이 한 문장이라
 * 동시에 들어온 같은 제보 중 하나만 접수된다. 넣었으면 true.
 */
export async function insertUnlessDuplicate(
  db: D1Database,
  report: NewReport,
  cutoff: UtcInstant,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO broken_link_reports (${COLUMNS})
       SELECT ?1, ?2, ?3, ?4, ?5, 'OPEN', ?6, NULL
       WHERE NOT EXISTS (
         SELECT 1 FROM broken_link_reports
         WHERE user_id = ?2 AND catalog_item_id = ?3 AND target = ?5 AND created_at > ?7
       )`,
    )
    .bind(
      report.id,
      report.userId,
      report.catalogItemId,
      report.trialRecordId,
      report.target,
      report.createdAt,
      cutoff,
    )
    .run();
  return result.meta.changes > 0;
}

/** 24시간 안의 가장 최근 같은 제보 (처리 상태와 무관) */
export async function findRecentDuplicate(
  db: D1Database,
  key: Pick<NewReport, 'userId' | 'catalogItemId' | 'target'>,
  cutoff: UtcInstant,
): Promise<BrokenLinkReport | null> {
  const row = await db
    .prepare(
      `SELECT ${COLUMNS} FROM broken_link_reports
       WHERE user_id = ? AND catalog_item_id = ? AND target = ? AND created_at > ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(key.userId, key.catalogItemId, key.target, cutoff)
    .first<Row>();
  return row ? toReport(row) : null;
}

export async function listReports(
  db: D1Database,
  filter: BrokenLinkReportFilter,
): Promise<BrokenLinkReport[]> {
  const { results } = await db
    .prepare(
      `SELECT ${COLUMNS} FROM broken_link_reports
       WHERE (?1 IS NULL OR status = ?1) AND (?2 IS NULL OR catalog_item_id = ?2)
       ORDER BY created_at DESC, id`,
    )
    .bind(filter.status ?? null, filter.catalogItemId ?? null)
    .all<Row>();
  return results.map(toReport);
}

/** 처리 결과를 저장하고 갱신된 제보를 돌려준다. 같은 결과로 다시 처리해도 처음 처리 시각을 지키고, 없으면 null */
export async function resolveReport(
  db: D1Database,
  id: string,
  status: ResolvedStatus,
  resolvedAt: UtcInstant,
): Promise<BrokenLinkReport | null> {
  const row = await db
    .prepare(
      `UPDATE broken_link_reports
       SET resolved_at = CASE WHEN status = ?2 THEN resolved_at ELSE ?3 END, status = ?2
       WHERE id = ?1
       RETURNING ${COLUMNS}`,
    )
    .bind(id, status, resolvedAt)
    .first<Row>();
  return row ? toReport(row) : null;
}
