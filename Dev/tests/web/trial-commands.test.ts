import { describe, expect, it } from 'vitest';
import { commandRequest } from '../../src/web/trials/commands';

describe('행동 버튼 → API 요청 [T27][S10][S28][S29][S31]', () => {
  const id = 'tr_1';

  it('계속 쓸래요 → POST /keep', () => {
    expect(commandRequest(id, 'KEEP')).toEqual({ path: '/api/trials/tr_1/keep' });
  });

  it('가입 안 했어요 → POST /void', () => {
    expect(commandRequest(id, 'VOID')).toEqual({ path: '/api/trials/tr_1/void' });
  });

  it('해지 완료했어요 → POST /confirm-cancel, 사유가 있을 때만 본문에 싣는다', () => {
    expect(commandRequest(id, 'CONFIRM_CANCEL')).toEqual({
      path: '/api/trials/tr_1/confirm-cancel',
    });
    expect(commandRequest(id, 'CONFIRM_CANCEL', 'PRICE_BURDEN')).toEqual({
      path: '/api/trials/tr_1/confirm-cancel',
      body: { exitReason: 'PRICE_BURDEN' },
    });
  });

  it('결제 확인 정정 세 가지는 billing-resolution의 resolution으로 간다', () => {
    const path = '/api/trials/tr_1/billing-resolution';
    expect(commandRequest(id, 'RESOLVE_BILLED')).toEqual({ path, body: { resolution: 'BILLED' } });
    expect(commandRequest(id, 'RESOLVE_KEEP_USING')).toEqual({
      path,
      body: { resolution: 'KEEP_USING' },
    });
    expect(commandRequest(id, 'RESOLVE_CANCELED_BEFORE_BILLING', 'COMPLEX_UX')).toEqual({
      path,
      body: { resolution: 'CANCELED_BEFORE_BILLING', exitReason: 'COMPLEX_UX' },
    });
  });

  it('결제 전에 해지했어요도 사유가 없으면 resolution만 보낸다 (기존 응답이 있는 기록)', () => {
    expect(commandRequest(id, 'RESOLVE_CANCELED_BEFORE_BILLING')).toEqual({
      path: '/api/trials/tr_1/billing-resolution',
      body: { resolution: 'CANCELED_BEFORE_BILLING' },
    });
  });

  it('유지·등록 취소·결제됐어요는 사유를 받아도 본문에 싣지 않는다', () => {
    expect(commandRequest(id, 'KEEP', 'PRICE_BURDEN')).toEqual({ path: '/api/trials/tr_1/keep' });
    expect(commandRequest(id, 'RESOLVE_BILLED', 'PRICE_BURDEN')).toEqual({
      path: '/api/trials/tr_1/billing-resolution',
      body: { resolution: 'BILLED' },
    });
  });

  it('화면 이동 버튼은 요청이 없다', () => {
    expect(commandRequest(id, 'GO_TO_BRIDGE')).toBeNull();
    expect(commandRequest(id, 'GO_TO_BRIDGE_GUIDE')).toBeNull();
    expect(commandRequest(id, 'VIEW_REFUND_TEMPLATE')).toBeNull();
  });

  it('기록 ID는 주소에 맞게 인코딩한다', () => {
    expect(commandRequest('a/b', 'KEEP')).toEqual({ path: '/api/trials/a%2Fb/keep' });
  });
});
