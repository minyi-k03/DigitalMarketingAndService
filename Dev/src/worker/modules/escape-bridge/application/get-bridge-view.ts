import type { components } from '../../../../shared/api-types';
import { DomainError } from '../../../platform/errors';
import type { EscapeBridgeDeps } from '../deps';
import { bridgeModeOf, EXIT_REASONS, isBackupFirst } from '../domain/bridge-mode';

export type BridgeView = components['schemas']['BridgeView'];

export interface BridgeViewQuery {
  userId: string;
  trialRecordId: string;
}

/**
 * 브릿지 화면 데이터 (SPEC §7, D-09, 스토리 16~19·22~24). 남의 기록은 TT가 `NOT_FOUND`로 거절하고,
 * 모드가 없는 상태(`VOIDED`·`KEPT` 등 종료 상태)는 `BRIDGE_NOT_AVAILABLE`이다.
 * 직링크는 `REENTRY`·`GUIDE_ONLY`에만 싣는다. `POLL`은 사유 선택 결과로만 받는다.
 */
export async function getBridgeView(
  deps: EscapeBridgeDeps,
  query: BridgeViewQuery,
): Promise<BridgeView> {
  const state = await deps.trialTracking.getBridgeState(query);
  const mode = bridgeModeOf(state.status);
  if (mode === undefined) {
    throw new DomainError(
      'BRIDGE_NOT_AVAILABLE',
      '이 기록은 해지 브릿지를 이용할 수 없는 상태입니다',
    );
  }
  const [escape, terms] = await Promise.all([
    deps.catalog.getEscapeContent(state.catalogItemId),
    deps.catalog.getTrackingTerms(state.catalogItemId),
  ]);
  const showLink = mode !== 'POLL';
  // 안내 모드는 투표 없이 가이드·직링크·제보만 쓴다 (SPEC §7 D-09). 백업 체크리스트는 POLL·REENTRY에서만 주고,
  // 항목이 없는 빈 목록은 없는 것으로 본다
  const backupChecklist =
    mode === 'GUIDE_ONLY' || escape.backupChecklist?.length === 0
      ? undefined
      : escape.backupChecklist;

  return {
    mode,
    trialRecordId: query.trialRecordId,
    catalogItemName: escape.name,
    ...(terms.logoUrl !== undefined && { catalogItemLogoUrl: terms.logoUrl }),
    escapePattern: escape.escapePattern,
    ...(escape.forcedChannel !== undefined && { forcedChannel: escape.forcedChannel }),
    escapeGuideSteps: escape.escapeGuideSteps,
    accessRetentionPolicy: escape.accessRetentionPolicy,
    ...(backupChecklist !== undefined && { backupChecklist }),
    backupFirst: isBackupFirst(escape.accessRetentionPolicy, backupChecklist),
    ...(mode === 'POLL' && { exitReasons: [...EXIT_REASONS] }),
    ...(showLink && { escapeLink: escape.escapeLink }),
    ...(showLink &&
      escape.escapeLinkFallbackUrl !== undefined && {
        escapeLinkFallbackUrl: escape.escapeLinkFallbackUrl,
      }),
    lastVerifiedAt: escape.lastVerifiedAt,
  };
}
