import type { ApiError } from '../api/response';

export type RegisterFailure =
  | { kind: 'duplicate'; existingTrialRecordId: string | undefined }
  | { kind: 'notice'; title: string; detail: string };

/** 체험 기록 생성(`POST /api/trials`)이 실패했을 때 화면에 보일 안내. 서버 내부 문구는 노출하지 않는다 */
export function describeRegisterError(error: ApiError): RegisterFailure {
  switch (error.code) {
    case 'DUPLICATE_ACTIVE_RECORD':
      return { kind: 'duplicate', existingTrialRecordId: error.existingTrialRecordId };
    case 'CATALOG_ITEM_NOT_PUBLISHED':
      return {
        kind: 'notice',
        title: '게시가 중단된 서비스예요',
        detail: '새로 추적할 수 없어요. 이미 추적 중이면 알림은 계속 받아요.',
      };
    case 'TRIAL_ALREADY_ENDED':
      return {
        kind: 'notice',
        title: '이미 끝난 체험이에요',
        detail: '결제 예정일이 지났어요. 시작일을 다시 확인해 주세요.',
      };
    case 'VALIDATION_FAILED':
      return {
        kind: 'notice',
        title: '입력을 확인해 주세요',
        detail: '시작일이나 체험 일수가 올바르지 않아요.',
      };
    case 'NOT_FOUND':
      return {
        kind: 'notice',
        title: '서비스를 찾을 수 없어요',
        detail: '목록으로 돌아가 다시 선택해 주세요.',
      };
    default:
      return { kind: 'notice', title: '등록하지 못했어요', detail: '잠시 뒤 다시 시도해 주세요.' };
  }
}
