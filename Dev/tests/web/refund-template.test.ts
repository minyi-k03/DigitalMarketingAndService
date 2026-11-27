import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../src/web/api/response';
import {
  describeRefundTemplateError,
  refundTemplatePath,
} from '../../src/web/trials/refund-template';

function error(code: ApiError['code'], status: number): ApiError {
  return { status, code, title: code };
}

describe('환불 요청 템플릿 화면 경로 [T27][S32]', () => {
  it('체험 기록 ID 아래 refund-template 경로다', () => {
    expect(refundTemplatePath('abc-123')).toBe('/trials/abc-123/refund-template');
  });

  it('ID의 특수 문자는 인코딩한다', () => {
    expect(refundTemplatePath('a/b?c')).toBe('/trials/a%2Fb%3Fc/refund-template');
  });
});

describe('환불 요청 템플릿 불러오기 실패 안내 [T27][S32][S31]', () => {
  it('없는 기록이거나 남의 기록이면 찾을 수 없다고 안내하고 재시도는 없다', () => {
    expect(describeRefundTemplateError(error('NOT_FOUND', 404))).toEqual({
      title: '체험을 찾을 수 없어요',
      detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
      retry: false,
    });
  });

  it('제공 상태가 아니면(BRIDGE_NOT_AVAILABLE) 결제 확인 단계 체험에서만 볼 수 있다고 안내한다', () => {
    expect(describeRefundTemplateError(error('BRIDGE_NOT_AVAILABLE', 422))).toEqual({
      title: '지금은 환불 요청 템플릿을 열 수 없어요',
      detail:
        '결제 확인이 필요하거나 결제가 확인된 체험에서만 보여 드려요. 내 체험에서 상태를 확인해 주세요.',
      retry: false,
    });
  });

  it('알 수 없는 오류는 서버 문구를 노출하지 않고 다시 시도하라고 안내한다', () => {
    const failure = describeRefundTemplateError({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'boom',
      detail: 'SQLITE_ERROR: secret',
    });
    expect(failure).toEqual({
      title: '환불 요청 템플릿을 불러오지 못했어요',
      detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      retry: true,
    });
    expect(JSON.stringify(failure)).not.toContain('secret');
  });
});
