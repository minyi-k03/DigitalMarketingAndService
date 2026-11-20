import type { ApiError } from '../api/response';

export type CommandFailure = {
  title: string;
  detail: string;
  /** 서버의 최신 기록과 어긋났다는 뜻이다. 화면은 안내를 닫을 때 목록·상세를 새로 불러온다 */
  stale: boolean;
};

/** 체험 기록 명령(유지·취소·해지 확정·정정·수정)이 실패했을 때 화면에 보일 안내. 서버 내부 문구는 노출하지 않는다 */
export function describeCommandError(error: ApiError): CommandFailure {
  switch (error.code) {
    case 'INVALID_TRANSITION':
    case 'CONFLICT':
      return {
        title: '이미 상태가 바뀐 체험이에요',
        // 안내를 보이는 동안 목록을 먼저 새로 불러오면 카드와 함께 안내도 사라진다.
        // 그래서 새로 불러오는 시점은 시트를 닫을 때다(`stale`)
        detail: '다른 곳에서 먼저 처리됐어요. 닫으면 최신 상태를 보여 드려요.',
        stale: true,
      };
    case 'EXIT_POLL_REQUIRED':
      return {
        title: '해지 이유를 골라 주세요',
        detail: '한 가지만 고르면 바로 처리돼요.',
        stale: false,
      };
    case 'TRIAL_ALREADY_ENDED':
      return {
        title: '이미 끝난 체험이에요',
        detail: '결제 예정일이 지났어요. 시작일이나 체험 일수를 다시 확인해 주세요.',
        stale: false,
      };
    case 'VALIDATION_FAILED':
      return {
        title: '입력을 확인해 주세요',
        detail: '시작일이나 체험 일수가 올바르지 않아요.',
        stale: false,
      };
    case 'NOT_FOUND':
      return {
        title: '체험을 찾을 수 없어요',
        detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
        stale: false,
      };
    default:
      return { title: '처리하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.', stale: false };
  }
}
