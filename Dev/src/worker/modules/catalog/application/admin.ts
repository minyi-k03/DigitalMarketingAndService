import type { components } from '../../../../shared/api-types';
import { toUtcInstant, todayKst } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import { newId } from '../../../platform/id';
import type { CatalogActor, CatalogDeps } from '../deps';
import { computeDarkPatternLevel } from '../domain/dark-pattern';
import { diffCatalogItems } from '../domain/change-diff';
import { canChangePublicationStatus } from '../domain/publication-status';
import {
  validateCatalogItemInput,
  type CatalogItemCandidate,
} from '../domain/validate-catalog-item';
import {
  findItemById,
  insertChangeLogStatement,
  insertItemStatement,
  listChangeLogs as listChangeLogRows,
  listItems,
  partnerExists,
  readCatalogSettings,
  updateItemStatement,
  updatePublicationStatusStatement,
  type CatalogItem,
  type CatalogSettings,
  type PublicationStatus,
} from '../infra/catalog-repo';

type CatalogItemInput = components['schemas']['CatalogItemInput'];
type CatalogItemPatch = components['schemas']['CatalogItemPatch'];

/** GUARDED_SERVICE는 운영자가 직접 등록하므로 PUBLISHED, SPONSORED_TRIAL은 검수 전 SUBMITTED (SPEC §2) */
const initialStatusOf = (kind: CatalogItem['kind']): PublicationStatus =>
  kind === 'GUARDED_SERVICE' ? 'PUBLISHED' : 'SUBMITTED';

/** 도메인 규칙(SPEC §2)과 소유 파트너 존재 여부를 검사해, 어긋나면 VALIDATION_FAILED를 던진다 */
async function assertValid(
  deps: CatalogDeps,
  candidate: CatalogItemCandidate,
  settings: CatalogSettings,
): Promise<void> {
  const errors = validateCatalogItemInput(candidate, {
    allowedDeepLinkSchemes: settings.allowedDeepLinkSchemes,
  });
  // 외래키 위반이 서버 오류로 새지 않게, 소유 파트너가 실제로 있는지 먼저 확인한다
  if (candidate.ownerPartnerId && !(await partnerExists(deps.db, candidate.ownerPartnerId))) {
    errors.push({ field: 'ownerPartnerId', message: '존재하지 않는 파트너입니다' });
  }
  if (errors.length > 0) {
    throw new DomainError('VALIDATION_FAILED', '카탈로그 항목이 올바르지 않습니다', { errors });
  }
}

export interface UpdateCatalogItemRequest {
  changes: CatalogItemPatch;
  /** 진행 중 기록에 버퍼 변경을 적용하는 기능은 T16에서 연결한다. 그 전에는 켜면 거부한다 */
  applyBufferToActiveRecords?: boolean;
  /** 해지 경로를 직접 확인했으면 최종 검증일을 오늘(KST)로 갱신 */
  markVerified?: boolean;
}

export async function updateCatalogItem(
  deps: CatalogDeps,
  actor: CatalogActor,
  id: string,
  request: UpdateCatalogItemRequest,
): Promise<CatalogItem> {
  if (request.applyBufferToActiveRecords) {
    throw new DomainError(
      'VALIDATION_FAILED',
      '진행 중 기록에 적용하는 기능은 아직 지원하지 않습니다',
      {
        errors: [
          {
            field: 'applyBufferToActiveRecords',
            message: '진행 중 기록 적용은 T16에서 연결되기 전까지 사용할 수 없습니다',
          },
        ],
      },
    );
  }

  const before = await getAdminCatalogItem(deps, id);
  const settings = await readCatalogSettings(deps.db);
  // 생략한 필드는 그대로 두고, null은 "지운다"(선택 필드만 받는다), 나머지는 새 값으로 바꾼다
  const requested = Object.entries(request.changes).filter(([, value]) => value !== undefined);
  const clearedFields = requested.filter(([, value]) => value === null).map(([field]) => field);
  const newValues = Object.fromEntries(
    requested.filter(([, value]) => value !== null),
  ) as Partial<CatalogItem>;

  const merged: CatalogItem = {
    ...before,
    ...newValues,
    lastVerifiedAt: request.markVerified ? todayKst(deps.clock) : before.lastVerifiedAt,
  };
  for (const field of clearedFields) {
    delete (merged as unknown as Record<string, unknown>)[field];
  }
  // D-15: PC_OR_APP_FORCED가 아닌 항목에는 forcedChannel이 없다. 해지 방식을 바꿀 때
  // 이전 채널이 남아 항상 검증에 걸리지 않도록 함께 비운다(직접 정했으면 그 값을 검증한다)
  if (
    newValues.escapePattern !== undefined &&
    newValues.escapePattern !== 'PC_OR_APP_FORCED' &&
    newValues.forcedChannel === undefined
  ) {
    delete merged.forcedChannel;
  }
  merged.darkPatternLevel = computeDarkPatternLevel(
    merged.darkPatternScores,
    settings.darkPatternRubric,
  );
  await assertValid(deps, merged, settings);

  const changes = diffCatalogItems(before, merged);
  if (changes.length === 0) return before;

  const now = toUtcInstant(deps.clock.now());
  await deps.db.batch([
    updateItemStatement(deps.db, merged, now),
    insertChangeLogStatement(deps.db, {
      id: newId(),
      catalogItemId: id,
      changedBy: actor.userId,
      changedAt: now,
      changes,
      appliedToActiveRecords: false,
    }),
  ]);
  return merged;
}

export async function createCatalogItem(
  deps: CatalogDeps,
  actor: CatalogActor,
  input: CatalogItemInput,
): Promise<CatalogItem> {
  const now = toUtcInstant(deps.clock.now());
  const settings = await readCatalogSettings(deps.db);

  const lastVerifiedAt = todayKst(deps.clock);
  await assertValid(deps, { ...input, lastVerifiedAt }, settings);

  const publicationStatus = initialStatusOf(input.kind);
  const item: CatalogItem = {
    ...input,
    id: newId(),
    publicationStatus,
    darkPatternLevel: computeDarkPatternLevel(input.darkPatternScores, settings.darkPatternRubric),
    lastVerifiedAt,
  };

  await deps.db.batch([
    insertItemStatement(deps.db, item, {
      publishedAt: publicationStatus === 'PUBLISHED' ? now : null,
      nowIso: now,
    }),
    insertChangeLogStatement(deps.db, {
      id: newId(),
      catalogItemId: item.id,
      changedBy: actor.userId,
      changedAt: now,
      changes: [{ field: 'publicationStatus', after: publicationStatus }],
      appliedToActiveRecords: false,
    }),
  ]);
  return item;
}

export async function changePublicationStatus(
  deps: CatalogDeps,
  actor: CatalogActor,
  id: string,
  to: PublicationStatus,
): Promise<CatalogItem> {
  const item = await getAdminCatalogItem(deps, id);
  const from = item.publicationStatus;
  if (!canChangePublicationStatus(from, to)) {
    throw new DomainError('INVALID_TRANSITION', `게시 상태를 ${from}에서 ${to}로 바꿀 수 없습니다`);
  }

  const now = toUtcInstant(deps.clock.now());
  const [update] = await deps.db.batch([
    updatePublicationStatusStatement(deps.db, { id, from, to, nowIso: now }),
    insertChangeLogStatement(
      deps.db,
      {
        id: newId(),
        catalogItemId: id,
        changedBy: actor.userId,
        changedAt: now,
        changes: [{ field: 'publicationStatus', before: from, after: to }],
        appliedToActiveRecords: false,
      },
      { onlyIfPreviousChanged: true },
    ),
  ]);
  // 읽은 뒤 다른 운영자가 먼저 바꿨다면 조건부 UPDATE가 0행이다. 이력도 남지 않았다
  if (update?.meta.changes === 0) {
    throw new DomainError(
      'CONFLICT',
      '다른 변경이 먼저 반영되었습니다. 새로고침 후 다시 시도하세요',
    );
  }
  return { ...item, publicationStatus: to };
}

export async function listAdminCatalogItems(
  deps: CatalogDeps,
  filter: { publicationStatus?: PublicationStatus } = {},
): Promise<CatalogItem[]> {
  return listItems(deps.db, filter);
}

export async function listChangeLogs(deps: CatalogDeps, catalogItemId: string) {
  return listChangeLogRows(deps.db, catalogItemId);
}

export async function getAdminCatalogItem(deps: CatalogDeps, id: string): Promise<CatalogItem> {
  const item = await findItemById(deps.db, id);
  if (!item) throw new DomainError('NOT_FOUND', '카탈로그 항목을 찾을 수 없습니다');
  return item;
}
