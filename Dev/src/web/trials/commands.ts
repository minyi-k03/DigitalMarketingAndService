import type { components } from '../../shared/api-types';
import type { ExitReason } from './labels';

type TrialAction = components['schemas']['TrialAction'];

export type CommandRequest = { path: string; body?: Record<string, string> };

/**
 * 행동 버튼을 API 요청으로 옮긴다 (openapi `/api/trials/{id}/…`).
 * 화면 이동 버튼은 요청이 없어 null이다. `exitReason`은 ExitPoll 응답이 필요한 명령에만 싣는다.
 */
export function commandRequest(
  trialRecordId: string,
  action: TrialAction,
  exitReason?: ExitReason,
): CommandRequest | null {
  const base = `/api/trials/${encodeURIComponent(trialRecordId)}`;
  const withReason: Record<string, string> = exitReason === undefined ? {} : { exitReason };

  switch (action) {
    case 'KEEP':
      return { path: `${base}/keep` };
    case 'VOID':
      return { path: `${base}/void` };
    case 'CONFIRM_CANCEL':
      return exitReason === undefined
        ? { path: `${base}/confirm-cancel` }
        : { path: `${base}/confirm-cancel`, body: withReason };
    case 'RESOLVE_BILLED':
      return { path: `${base}/billing-resolution`, body: { resolution: 'BILLED' } };
    case 'RESOLVE_KEEP_USING':
      return { path: `${base}/billing-resolution`, body: { resolution: 'KEEP_USING' } };
    case 'RESOLVE_CANCELED_BEFORE_BILLING':
      return {
        path: `${base}/billing-resolution`,
        body: { resolution: 'CANCELED_BEFORE_BILLING', ...withReason },
      };
    case 'GO_TO_BRIDGE':
    case 'GO_TO_BRIDGE_GUIDE':
    case 'VIEW_REFUND_TEMPLATE':
      return null;
  }
}
