import type { ApiError } from '../api/response';

const NOT_FOUND_TITLE = '체험을 찾을 수 없어요';
const NOT_FOUND_DETAIL = '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.';

export type BridgeCommandFailure = {
  title: string;
  detail: string;
  /** 서버의 최신 상태와 어긋났다는 뜻이다. 화면이 바로 브릿지를 다시 불러온다 */
  refresh: boolean;
};

/**
 * 사유 버튼(`POST /cancel-attempts`)이 실패했을 때의 안내. 서버 내부 문구는 노출하지 않는다.
 * 사유 선택과 상태 전이는 한 트랜잭션이라 실패하면 사유도 저장되지 않는다 (SPEC §7).
 */
export function describeBridgeCommandError(error: ApiError): BridgeCommandFailure {
  switch (error.code) {
    case 'INVALID_TRANSITION':
    case 'CONFLICT':
      return {
        title: '이미 해지를 시작했거나 상태가 바뀐 체험이에요',
        detail: '다른 곳에서 먼저 처리됐어요. 최신 상태로 바꿔 보여 드려요.',
        refresh: true,
      };
    case 'NOT_FOUND':
      return { title: NOT_FOUND_TITLE, detail: NOT_FOUND_DETAIL, refresh: false };
    default:
      return {
        title: '이동하지 못했어요',
        detail: '잠시 뒤 다시 시도해 주세요. 사유는 저장되지 않았어요.',
        refresh: false,
      };
  }
}

export type BridgeLoadFailure = { title: string; detail: string; retry: boolean };

/**
 * 브릿지 화면 데이터(`GET /bridge`)를 못 불러왔을 때의 안내.
 * `BRIDGE_NOT_AVAILABLE`은 환불 템플릿 등 다른 엔드포인트도 쓰는 코드라 이 화면의 문구를 여기서 정한다 (T22).
 */
export function describeBridgeLoadError(error: ApiError): BridgeLoadFailure {
  switch (error.code) {
    case 'NOT_FOUND':
      return { title: NOT_FOUND_TITLE, detail: NOT_FOUND_DETAIL, retry: false };
    case 'BRIDGE_NOT_AVAILABLE':
      return {
        title: '지금은 해지 안내를 열 수 없어요',
        detail: '이미 끝난 체험은 해지 안내가 없어요. 내 체험에서 상태를 확인해 주세요.',
        retry: false,
      };
    default:
      return {
        title: '해지 안내를 불러오지 못했어요',
        detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        retry: true,
      };
  }
}

export type BrokenLinkReportFailure = { title: string; detail: string };

/** 경로 오류 제보(`POST /broken-link-reports`) 실패 안내. 서버 내부 문구는 노출하지 않는다 */
export function describeBrokenLinkReportError(error: ApiError): BrokenLinkReportFailure {
  if (error.code === 'NOT_FOUND') {
    return { title: NOT_FOUND_TITLE, detail: NOT_FOUND_DETAIL };
  }
  return {
    title: '제보를 보내지 못했어요',
    detail: '잠시 뒤 다시 시도해 주세요.',
  };
}
