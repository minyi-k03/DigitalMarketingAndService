import type { components } from '../../shared/api-types';
import type { ExitReason, TrialStatus } from './labels';

export type TrialAction = components['schemas']['TrialAction'];

export type ActionConfirm = { title: string; detail: string; button: string };

export type ActionPresentation = {
  action: TrialAction;
  label: string;
  /** `bridge`는 해지 브릿지로 이동하는 링크, `command`는 확인을 거쳐 API를 호출한다 */
  kind: 'bridge' | 'command';
  /** 화면의 유일한 파란 버튼 (DESIGN-notion: 파란색은 행동에만) */
  primary: boolean;
  confirm: ActionConfirm | null;
};

const KEEP_CONFIRM: ActionConfirm = {
  title: '계속 쓰기로 할까요?',
  detail: '유료로 계속 쓰는 것으로 기록하고 이 체험의 알림을 멈춰요. 되돌릴 수 없어요.',
  button: '계속 쓸래요',
};

const COMMANDS: Partial<Record<TrialAction, { label: string; confirm: ActionConfirm }>> = {
  KEEP: { label: '계속 쓸래요', confirm: KEEP_CONFIRM },
  RESOLVE_KEEP_USING: { label: '계속 쓸래요', confirm: KEEP_CONFIRM },
  VOID: {
    label: '가입 안 했어요',
    confirm: {
      title: '등록을 취소할까요?',
      detail: '실제로 가입하지 않았다면 이 기록을 취소해요. 해지 알림도 받지 않아요.',
      button: '등록 취소',
    },
  },
  CONFIRM_CANCEL: {
    label: '해지 완료했어요',
    confirm: {
      title: '해지를 마쳤나요?',
      detail:
        '외부 사이트에서 해지를 끝냈다면 확정해 주세요. 안전 만료일 안에 확정하면 방어 금액에 합산돼요.',
      button: '해지 완료',
    },
  },
  RESOLVE_BILLED: {
    label: '결제됐어요',
    confirm: {
      title: '결제가 됐나요?',
      detail: '결제된 것으로 기록해요. 다음 달 결제를 막는 방법을 이어서 안내해요.',
      button: '결제됐어요',
    },
  },
  RESOLVE_CANCELED_BEFORE_BILLING: {
    label: '결제 전에 해지했어요',
    confirm: {
      title: '결제 전에 해지했나요?',
      detail: '해지를 마친 것으로 기록해요.',
      button: '결제 전에 해지했어요',
    },
  },
};

/** 한 카드에서 파란 버튼이 될 행동. 상태마다 하나뿐이고 응답이 필요한 MISSED_BILLED에는 없다 */
const PRIMARY: Partial<Record<TrialStatus, TrialAction>> = {
  TRACKING: 'GO_TO_BRIDGE',
  CANCEL_ATTEMPTED: 'CONFIRM_CANCEL',
  BILLED_CONFIRMED: 'GO_TO_BRIDGE_GUIDE',
};

function bridgeLabel(action: TrialAction, status: TrialStatus): string {
  if (action === 'GO_TO_BRIDGE_GUIDE') return '다음 달 결제 막기';
  return status === 'CANCEL_ATTEMPTED' ? '다시 해지하러 가기' : '해지하러 가기';
}

/**
 * 서버가 내려 준 `actions`를 화면에 보일 버튼으로 옮긴다 (SPEC §13, D-09, architecture §5.9).
 * 서버가 준 것만 보이고 순서는 서버를 따른다. `VIEW_REFUND_TEMPLATE`는 T22(환불 템플릿 API) 전까지 숨긴다.
 */
export function presentActions(
  status: TrialStatus,
  actions: readonly TrialAction[],
): ActionPresentation[] {
  const result: ActionPresentation[] = [];
  for (const action of actions) {
    const primary = PRIMARY[status] === action;
    if (action === 'GO_TO_BRIDGE' || action === 'GO_TO_BRIDGE_GUIDE') {
      result.push({
        action,
        label: bridgeLabel(action, status),
        kind: 'bridge',
        primary,
        confirm: null,
      });
      continue;
    }
    const command = COMMANDS[action];
    if (command) {
      result.push({
        action,
        label: command.label,
        kind: 'command',
        primary,
        confirm: command.confirm,
      });
    }
  }
  return result;
}

/**
 * ExitPoll 응답을 이 행동에서 받아야 하는가. 기록에 이미 사유가 있으면 다시 묻지 않는다
 * (해지 브릿지에서 고른 경우, SPEC §5 `ExitPoll` 불변식·스토리 28·31).
 */
export function exitReasonRequired(
  action: TrialAction,
  record: { exitReason?: ExitReason | undefined },
): boolean {
  if (action !== 'CONFIRM_CANCEL' && action !== 'RESOLVE_CANCELED_BEFORE_BILLING') return false;
  return record.exitReason === undefined;
}

/** 날짜 수정은 추적 중·해지 진행 중 기록만 (SPEC §5 수정 범위) */
export function canEdit(status: TrialStatus): boolean {
  return status === 'TRACKING' || status === 'CANCEL_ATTEMPTED';
}

/** 해지 브릿지를 거치지 않고 직접 해지한 경우의 확정 진입점. 상세 화면에만 둔다 (스토리 28) */
export function canDirectCancel(status: TrialStatus): boolean {
  return status === 'TRACKING';
}
