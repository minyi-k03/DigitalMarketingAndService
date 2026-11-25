import { getBridgeView, type BridgeViewQuery } from './application/get-bridge-view';
import type { EscapeBridgeDeps } from './deps';

export type { EscapeBridgeDeps } from './deps';
export type { BridgeView, BridgeViewQuery } from './application/get-bridge-view';

/** EscapeBridge & Recovery 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createEscapeBridgeService(deps: EscapeBridgeDeps) {
  return {
    getBridgeView: (query: BridgeViewQuery) => getBridgeView(deps, query),
  };
}

export type EscapeBridgeService = ReturnType<typeof createEscapeBridgeService>;
