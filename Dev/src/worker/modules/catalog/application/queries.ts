import type { components } from '../../../../shared/api-types';
import type { CatalogDeps } from '../deps';
import { DomainError } from '../../../platform/errors';
import {
  listPubliclyVisibleItems,
  type CatalogItem,
  type PublicationStatus,
} from '../infra/catalog-repo';
import { getAdminCatalogItem } from './admin';

export type CatalogItemPublicView = components['schemas']['CatalogItemPublicView'];

/**
 * 관리 항목을 공개 응답으로 옮긴다 (SPEC §7, §19, D-11).
 * 필드를 하나씩 적어 `escapeLink`·`escapeLinkFallbackUrl`·`ownerPartnerId`·`darkPatternScores`가
 * 새로 생기는 필드와 함께 실수로 나가지 않게 한다. 목록·상세에 노출되지 않는 게시 상태는 `null`이다.
 */
function toPublicView(item: CatalogItem): CatalogItemPublicView | null {
  const { publicationStatus } = item;
  if (publicationStatus !== 'PUBLISHED' && publicationStatus !== 'UNPUBLISHED') return null;

  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    ...(item.logoUrl !== undefined && { logoUrl: item.logoUrl }),
    ...(item.signupUrl !== undefined && { signupUrl: item.signupUrl }),
    publicationStatus,
    serviceCategory: item.serviceCategory,
    monthlyPrice: item.monthlyPrice,
    defaultTrialDays: item.defaultTrialDays,
    isGlobalTimeZoneBufferRequired: item.isGlobalTimeZoneBufferRequired,
    darkPatternLevel: item.darkPatternLevel,
    escapePattern: item.escapePattern,
    ...(item.forcedChannel !== undefined && { forcedChannel: item.forcedChannel }),
    escapeGuideSteps: item.escapeGuideSteps,
    accessRetentionPolicy: item.accessRetentionPolicy,
    ...(item.backupChecklist !== undefined && { backupChecklist: item.backupChecklist }),
    ...(item.eduBenefit !== undefined && { eduBenefit: item.eduBenefit }),
    supportContact: item.supportContact,
    lastVerifiedAt: item.lastVerifiedAt,
  };
}

export interface ListCatalogFilter {
  category?: CatalogItem['serviceCategory'];
  /** 서비스명 검색어 */
  q?: string;
}

/** 공개 목록. PUBLISHED·UNPUBLISHED만 나온다 (V-01) */
export async function listCatalog(
  deps: CatalogDeps,
  filter: ListCatalogFilter = {},
): Promise<CatalogItemPublicView[]> {
  const items = await listPubliclyVisibleItems(deps.db, filter);
  return items.flatMap((item) => toPublicView(item) ?? []);
}

/** 공개 상세. 노출되지 않는 항목(SUBMITTED·REJECTED)은 없는 항목과 똑같이 NOT_FOUND다 (V-03, V-08) */
export async function getCatalogItem(
  deps: CatalogDeps,
  id: string,
): Promise<CatalogItemPublicView> {
  const view = toPublicView(await getAdminCatalogItem(deps, id));
  if (!view) throw new DomainError('NOT_FOUND', '카탈로그 항목을 찾을 수 없습니다');
  return view;
}

/** Trial Tracking이 기록을 만들 때 쓰는 조건 (architecture §3). 게시 상태를 함께 줘 호출한 쪽이 거부한다 */
export interface TrackingTerms {
  name: string;
  publicationStatus: PublicationStatus;
  defaultTrialDays: number;
  isGlobalTimeZoneBufferRequired: boolean;
  monthlyPrice: number;
  serviceCategory: CatalogItem['serviceCategory'];
  accessRetentionPolicy: CatalogItem['accessRetentionPolicy'];
}

export async function getTrackingTerms(deps: CatalogDeps, id: string): Promise<TrackingTerms> {
  const item = await getAdminCatalogItem(deps, id);
  return {
    name: item.name,
    publicationStatus: item.publicationStatus,
    defaultTrialDays: item.defaultTrialDays,
    isGlobalTimeZoneBufferRequired: item.isGlobalTimeZoneBufferRequired,
    monthlyPrice: item.monthlyPrice,
    serviceCategory: item.serviceCategory,
    accessRetentionPolicy: item.accessRetentionPolicy,
  };
}

/**
 * EscapeBridge·Trial Tracking이 해지 안내를 만들 때 쓰는 내용 (architecture §3, SPEC §7·§9).
 * 직링크가 들어 있으므로 HTTP 응답에 그대로 내보내지 않고 모듈 사이에서만 쓴다.
 */
export interface EscapeContent {
  name: string;
  escapePattern: CatalogItem['escapePattern'];
  forcedChannel?: NonNullable<CatalogItem['forcedChannel']>;
  escapeGuideSteps: string[];
  escapeLink: string;
  escapeLinkFallbackUrl?: string;
  accessRetentionPolicy: CatalogItem['accessRetentionPolicy'];
  backupChecklist?: string[];
  supportContact: CatalogItem['supportContact'];
  lastVerifiedAt: CatalogItem['lastVerifiedAt'];
}

export async function getEscapeContent(deps: CatalogDeps, id: string): Promise<EscapeContent> {
  const item = await getAdminCatalogItem(deps, id);
  return {
    name: item.name,
    escapePattern: item.escapePattern,
    ...(item.forcedChannel !== undefined && { forcedChannel: item.forcedChannel }),
    escapeGuideSteps: item.escapeGuideSteps,
    escapeLink: item.escapeLink,
    ...(item.escapeLinkFallbackUrl !== undefined && {
      escapeLinkFallbackUrl: item.escapeLinkFallbackUrl,
    }),
    accessRetentionPolicy: item.accessRetentionPolicy,
    ...(item.backupChecklist !== undefined && { backupChecklist: item.backupChecklist }),
    supportContact: item.supportContact,
    lastVerifiedAt: item.lastVerifiedAt,
  };
}
