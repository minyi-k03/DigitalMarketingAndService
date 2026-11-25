import type { components } from '../../../../shared/api-types';

export type BridgeMode = components['schemas']['BridgeView']['mode'];
type TrialStatus = components['schemas']['TrialStatus'];
type ExitReason = components['schemas']['ExitReason'];
type AccessRetentionPolicy = components['schemas']['AccessRetentionPolicy'];

/**
 * 기록 상태별 브릿지 모드 (SPEC §7, D-09, architecture §6 표). 진입할 수 없는 상태는 `undefined`다.
 * `MISSED_BILLED`·`BILLED_CONFIRMED`는 가이드만 보여 주고 투표·상태 변화가 없다.
 */
export function bridgeModeOf(status: TrialStatus): BridgeMode | undefined {
  switch (status) {
    case 'TRACKING':
      return 'POLL';
    case 'CANCEL_ATTEMPTED':
      return 'REENTRY';
    case 'MISSED_BILLED':
    case 'BILLED_CONFIRMED':
      return 'GUIDE_ONLY';
    default:
      return undefined;
  }
}

/** POLL 모드에서 보여 줄 사유 버튼 5개 (SPEC §12 `ExitReason`, 표시 순서) */
export const EXIT_REASONS = [
  'PRICE_BURDEN',
  'LACK_OF_FEATURES',
  'COMPLEX_UX',
  'SHORT_TERM_GOAL_MET',
  'MOVED_TO_ALTERNATIVE',
] as const satisfies readonly ExitReason[];

/** 즉시 해지로 데이터가 사라지는 서비스에 백업 체크리스트가 있으면 투표보다 위에 둔다 (SPEC §7, V-05) */
export function isBackupFirst(
  policy: AccessRetentionPolicy,
  backupChecklist: readonly string[] | undefined,
): boolean {
  return policy === 'IMMEDIATE_TERMINATION' && (backupChecklist?.length ?? 0) > 0;
}
