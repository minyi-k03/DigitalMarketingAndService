import type { components } from '../../shared/api-types';

type BridgeView = components['schemas']['BridgeView'];

/** `action`은 모드별 행동 영역(사유 버튼 또는 해지 링크 버튼)이다 */
export type BridgeSection = 'backup' | 'guide' | 'action';

/**
 * 한 화면의 영역 순서 (SPEC §7).
 * - `IMMEDIATE_TERMINATION`(`backupFirst`)은 백업 체크리스트를 사유 버튼 위에 먼저 둔다 (V-05).
 * - 가이드는 언제나 행동 영역 위에 있어 `SPA_MODAL_GUIDE`의 '사유 버튼 위에 고정 표시'를 함께 만족한다.
 * - 체크리스트가 없는 항목에는 백업 영역을 만들지 않는다.
 */
export function bridgeSections(
  view: Pick<BridgeView, 'backupFirst' | 'backupChecklist'>,
): BridgeSection[] {
  const hasBackup = (view.backupChecklist?.length ?? 0) > 0;
  if (!hasBackup) return ['guide', 'action'];
  return view.backupFirst ? ['backup', 'guide', 'action'] : ['guide', 'backup', 'action'];
}
