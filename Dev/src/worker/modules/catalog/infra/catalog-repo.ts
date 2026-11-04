import type { components } from '../../../../shared/api-types';
import type { UtcInstant } from '../../../../shared/kst-date';
import type { DarkPatternRubric } from '../domain/dark-pattern';
import type { PublicationStatus } from '../domain/publication-status';

export type { PublicationStatus };
export type CatalogItem = components['schemas']['CatalogItem'];
export type CatalogChange = components['schemas']['CatalogChangeLog']['changes'][number];

interface CatalogItemRow {
  id: string;
  kind: CatalogItem['kind'];
  name: string;
  logo_url: string | null;
  signup_url: string | null;
  publication_status: PublicationStatus;
  owner_partner_id: string | null;
  service_category: CatalogItem['serviceCategory'];
  monthly_price: number;
  default_trial_days: number;
  is_global_time_zone_buffer_required: number;
  dark_pattern_scores: string;
  dark_pattern_level: CatalogItem['darkPatternLevel'];
  escape_pattern: CatalogItem['escapePattern'];
  forced_channel: NonNullable<CatalogItem['forcedChannel']> | null;
  escape_guide_steps: string;
  escape_link: string;
  escape_link_fallback_url: string | null;
  access_retention_policy: CatalogItem['accessRetentionPolicy'];
  backup_checklist: string | null;
  edu_benefit: string | null;
  support_contact: string;
  last_verified_at: string;
}

const SELECT_ITEM = `SELECT id, kind, name, logo_url, signup_url, publication_status, owner_partner_id,
  service_category, monthly_price, default_trial_days, is_global_time_zone_buffer_required,
  dark_pattern_scores, dark_pattern_level, escape_pattern, forced_channel, escape_guide_steps,
  escape_link, escape_link_fallback_url, access_retention_policy, backup_checklist, edu_benefit,
  support_contact, last_verified_at
  FROM catalog_items`;

/** 값이 있을 때만 키를 만든다. 선택 필드를 `undefined`로 채우지 않기 위함 */
const present = <K extends string, V>(key: K, value: V | null | undefined) =>
  value === null || value === undefined ? {} : ({ [key]: value } as Record<K, V>);

function toCatalogItem(row: CatalogItemRow): CatalogItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    ...present('logoUrl', row.logo_url),
    ...present('signupUrl', row.signup_url),
    publicationStatus: row.publication_status,
    ...present('ownerPartnerId', row.owner_partner_id),
    serviceCategory: row.service_category,
    monthlyPrice: row.monthly_price,
    defaultTrialDays: row.default_trial_days,
    isGlobalTimeZoneBufferRequired: row.is_global_time_zone_buffer_required === 1,
    darkPatternScores: JSON.parse(row.dark_pattern_scores) as CatalogItem['darkPatternScores'],
    darkPatternLevel: row.dark_pattern_level,
    escapePattern: row.escape_pattern,
    ...present('forcedChannel', row.forced_channel),
    escapeGuideSteps: JSON.parse(row.escape_guide_steps) as string[],
    escapeLink: row.escape_link,
    ...present('escapeLinkFallbackUrl', row.escape_link_fallback_url),
    accessRetentionPolicy: row.access_retention_policy,
    ...(row.backup_checklist !== null && {
      backupChecklist: JSON.parse(row.backup_checklist) as string[],
    }),
    ...(row.edu_benefit !== null && {
      eduBenefit: JSON.parse(row.edu_benefit) as NonNullable<CatalogItem['eduBenefit']>,
    }),
    supportContact: JSON.parse(row.support_contact) as CatalogItem['supportContact'],
    lastVerifiedAt: row.last_verified_at,
  };
}

/** 관리용 목록: 모든 게시 상태, 최근 등록순 */
export async function listItems(
  db: D1Database,
  filter: { publicationStatus?: PublicationStatus } = {},
): Promise<CatalogItem[]> {
  const where = filter.publicationStatus ? ' WHERE publication_status = ?' : '';
  const statement = db.prepare(`${SELECT_ITEM}${where} ORDER BY created_at DESC, rowid DESC`);
  const { results } = await (
    filter.publicationStatus ? statement.bind(filter.publicationStatus) : statement
  ).all<CatalogItemRow>();
  return results.map(toCatalogItem);
}

export async function findItemById(db: D1Database, id: string): Promise<CatalogItem | null> {
  const row = await db.prepare(`${SELECT_ITEM} WHERE id = ?`).bind(id).first<CatalogItemRow>();
  return row ? toCatalogItem(row) : null;
}

export async function partnerExists(db: D1Database, partnerId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT 1 AS found FROM partners WHERE id = ?')
    .bind(partnerId)
    .first();
  return row !== null;
}

const jsonOrNull = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

export function insertItemStatement(
  db: D1Database,
  item: CatalogItem,
  times: { publishedAt: UtcInstant | null; nowIso: UtcInstant },
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO catalog_items (
         id, kind, name, logo_url, signup_url, publication_status, owner_partner_id,
         service_category, monthly_price, default_trial_days, is_global_time_zone_buffer_required,
         dark_pattern_scores, dark_pattern_level, escape_pattern, forced_channel, escape_guide_steps,
         escape_link, escape_link_fallback_url, access_retention_policy, backup_checklist,
         edu_benefit, support_contact, last_verified_at, published_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      item.id,
      item.kind,
      item.name,
      item.logoUrl ?? null,
      item.signupUrl ?? null,
      item.publicationStatus,
      item.ownerPartnerId ?? null,
      item.serviceCategory,
      item.monthlyPrice,
      item.defaultTrialDays,
      item.isGlobalTimeZoneBufferRequired ? 1 : 0,
      JSON.stringify(item.darkPatternScores),
      item.darkPatternLevel,
      item.escapePattern,
      item.forcedChannel ?? null,
      JSON.stringify(item.escapeGuideSteps),
      item.escapeLink,
      item.escapeLinkFallbackUrl ?? null,
      item.accessRetentionPolicy,
      jsonOrNull(item.backupChecklist),
      jsonOrNull(item.eduBenefit),
      JSON.stringify(item.supportContact),
      item.lastVerifiedAt,
      times.publishedAt,
      times.nowIso,
      times.nowIso,
    );
}

/** 수정 가능한 컬럼 전체를 항목 값으로 덮어쓴다. 게시 상태·로고·게시 시각은 건드리지 않는다 */
export function updateItemStatement(
  db: D1Database,
  item: CatalogItem,
  nowIso: UtcInstant,
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE catalog_items SET
         name = ?, signup_url = ?, owner_partner_id = ?, service_category = ?, monthly_price = ?,
         default_trial_days = ?, is_global_time_zone_buffer_required = ?, dark_pattern_scores = ?,
         dark_pattern_level = ?, escape_pattern = ?, forced_channel = ?, escape_guide_steps = ?,
         escape_link = ?, escape_link_fallback_url = ?, access_retention_policy = ?,
         backup_checklist = ?, edu_benefit = ?, support_contact = ?, last_verified_at = ?,
         updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      item.name,
      item.signupUrl ?? null,
      item.ownerPartnerId ?? null,
      item.serviceCategory,
      item.monthlyPrice,
      item.defaultTrialDays,
      item.isGlobalTimeZoneBufferRequired ? 1 : 0,
      JSON.stringify(item.darkPatternScores),
      item.darkPatternLevel,
      item.escapePattern,
      item.forcedChannel ?? null,
      JSON.stringify(item.escapeGuideSteps),
      item.escapeLink,
      item.escapeLinkFallbackUrl ?? null,
      item.accessRetentionPolicy,
      jsonOrNull(item.backupChecklist),
      jsonOrNull(item.eduBenefit),
      JSON.stringify(item.supportContact),
      item.lastVerifiedAt,
      nowIso,
      item.id,
    );
}

export interface ChangeLogInput {
  id: string;
  catalogItemId: string;
  changedBy: string;
  changedAt: UtcInstant;
  changes: CatalogChange[];
  appliedToActiveRecords: boolean;
}

/**
 * 변경 이력 INSERT. `onlyIfPreviousChanged`이면 바로 앞 문장이 행을 바꿨을 때만 넣는다.
 * 같은 batch 안의 조건부 UPDATE가 동시 변경에 져서 0행이면 이력도 남기지 않기 위함이다.
 */
export function insertChangeLogStatement(
  db: D1Database,
  log: ChangeLogInput,
  options: { onlyIfPreviousChanged?: boolean } = {},
): D1PreparedStatement {
  const guard = options.onlyIfPreviousChanged ? ' WHERE changes() > 0' : '';
  return db
    .prepare(
      `INSERT INTO catalog_change_logs
         (id, catalog_item_id, changed_by, changed_at, changes, applied_to_active_records)
       SELECT ?, ?, ?, ?, ?, ?${guard}`,
    )
    .bind(
      log.id,
      log.catalogItemId,
      log.changedBy,
      log.changedAt,
      JSON.stringify(log.changes),
      log.appliedToActiveRecords ? 1 : 0,
    );
}

/** `from` 상태일 때만 바꾸는 조건부 UPDATE. 게시되는 순간에는 `published_at`도 채운다 */
export function updatePublicationStatusStatement(
  db: D1Database,
  input: { id: string; from: PublicationStatus; to: PublicationStatus; nowIso: UtcInstant },
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE catalog_items
       SET publication_status = ?1,
           published_at = CASE WHEN ?1 = 'PUBLISHED' THEN ?2 ELSE published_at END,
           updated_at = ?2
       WHERE id = ?3 AND publication_status = ?4`,
    )
    .bind(input.to, input.nowIso, input.id, input.from);
}

type CatalogChangeLog = components['schemas']['CatalogChangeLog'];

interface ChangeLogRow {
  id: string;
  catalog_item_id: string;
  changed_by: string;
  changed_at: string;
  changes: string;
  applied_to_active_records: number;
}

/** 최신 변경이 먼저. 같은 시각이면 나중에 들어간 행이 먼저 */
export async function listChangeLogs(
  db: D1Database,
  catalogItemId: string,
): Promise<CatalogChangeLog[]> {
  const { results } = await db
    .prepare(
      `SELECT id, catalog_item_id, changed_by, changed_at, changes, applied_to_active_records
       FROM catalog_change_logs WHERE catalog_item_id = ?
       ORDER BY changed_at DESC, rowid DESC`,
    )
    .bind(catalogItemId)
    .all<ChangeLogRow>();
  return results.map((row) => ({
    id: row.id,
    catalogItemId: row.catalog_item_id,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changes: JSON.parse(row.changes) as CatalogChange[],
    appliedToActiveRecords: row.applied_to_active_records === 1,
  }));
}

export interface CatalogSettings {
  darkPatternRubric: DarkPatternRubric;
  allowedDeepLinkSchemes: string[];
}

const DEFAULT_SETTINGS: CatalogSettings = {
  darkPatternRubric: { mediumMin: 2, highMin: 4 },
  allowedDeepLinkSchemes: [],
};

/** `app_settings`의 `catalog.*` 키를 읽는다. 행이 없으면 기본값을 쓴다 (SPEC §2) */
export async function readCatalogSettings(db: D1Database): Promise<CatalogSettings> {
  const { results } = await db
    .prepare(
      `SELECT key, value FROM app_settings
       WHERE key IN ('catalog.darkPatternRubric', 'catalog.allowedDeepLinkSchemes')`,
    )
    .all<{ key: string; value: string }>();
  const byKey = new Map(results.map((r) => [r.key, JSON.parse(r.value) as unknown]));

  return {
    darkPatternRubric:
      (byKey.get('catalog.darkPatternRubric') as DarkPatternRubric | undefined) ??
      DEFAULT_SETTINGS.darkPatternRubric,
    allowedDeepLinkSchemes:
      (byKey.get('catalog.allowedDeepLinkSchemes') as string[] | undefined) ??
      DEFAULT_SETTINGS.allowedDeepLinkSchemes,
  };
}
