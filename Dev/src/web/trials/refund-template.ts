import type { ApiError } from '../api/response';

/** 환불 요청 템플릿 화면 경로 (T27, SPEC §9). 체험 상세 아래에 둔다 */
export function refundTemplatePath(trialRecordId: string): string {
  return `/trials/${encodeURIComponent(trialRecordId)}/refund-template`;
}

export type RefundTemplateLoadFailure = { title: string; detail: string; retry: boolean };

/**
 * 템플릿(`GET /refund-template`)을 못 불러왔을 때의 안내. 서버 내부 문구는 노출하지 않는다.
 * `BRIDGE_NOT_AVAILABLE`은 해지 브릿지와 같이 쓰는 코드라 이 화면의 문구를 여기서 정한다 (T22).
 */
export function describeRefundTemplateError(error: ApiError): RefundTemplateLoadFailure {
  switch (error.code) {
    case 'NOT_FOUND':
      return {
        title: '체험을 찾을 수 없어요',
        detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
        retry: false,
      };
    case 'BRIDGE_NOT_AVAILABLE':
      return {
        title: '지금은 환불 요청 템플릿을 열 수 없어요',
        detail:
          '결제 확인이 필요하거나 결제가 확인된 체험에서만 보여 드려요. 내 체험에서 상태를 확인해 주세요.',
        retry: false,
      };
    default:
      return {
        title: '환불 요청 템플릿을 불러오지 못했어요',
        detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
        retry: true,
      };
  }
}
