import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import {
  canDirectCancel,
  canEdit,
  exitReasonRequired,
  presentActions,
} from '../../src/web/trials/actions';

type Status = components['schemas']['TrialStatus'];
type Action = components['schemas']['TrialAction'];

// 서버가 상태별로 내려주는 actions (architecture §5.9)
const SERVER_ACTIONS: Record<Status, Action[]> = {
  TRACKING: ['GO_TO_BRIDGE', 'KEEP', 'VOID'],
  CANCEL_ATTEMPTED: ['CONFIRM_CANCEL', 'GO_TO_BRIDGE', 'KEEP'],
  MISSED_BILLED: [
    'RESOLVE_BILLED',
    'RESOLVE_CANCELED_BEFORE_BILLING',
    'RESOLVE_KEEP_USING',
    'GO_TO_BRIDGE_GUIDE',
    'VIEW_REFUND_TEMPLATE',
  ],
  BILLED_CONFIRMED: ['GO_TO_BRIDGE_GUIDE', 'VIEW_REFUND_TEMPLATE'],
  CANCELED_CONFIRMED: [],
  KEPT: [],
  VOIDED: [],
};

function labelsFor(status: Status) {
  return presentActions(status, SERVER_ACTIONS[status]).map((a) => a.label);
}

describe('내 체험 행동 버튼 표시 [T27][S41][D-09]', () => {
  it('TRACKING: 해지하러 가기 · 계속 쓸래요 · 가입 안 했어요 (SPEC §13)', () => {
    expect(labelsFor('TRACKING')).toEqual(['해지하러 가기', '계속 쓸래요', '가입 안 했어요']);
  });

  it('CANCEL_ATTEMPTED: 해지 완료했어요 · 다시 해지하러 가기 · 계속 쓸래요', () => {
    expect(labelsFor('CANCEL_ATTEMPTED')).toEqual([
      '해지 완료했어요',
      '다시 해지하러 가기',
      '계속 쓸래요',
    ]);
  });

  it('MISSED_BILLED: 결제 확인 정정 세 가지, 다음 달 결제 막기, 환불 요청 템플릿 보기 (D-09, SPEC §9)', () => {
    expect(labelsFor('MISSED_BILLED')).toEqual([
      '결제됐어요',
      '결제 전에 해지했어요',
      '계속 쓸래요',
      '다음 달 결제 막기',
      '환불 요청 템플릿 보기',
    ]);
  });

  it('BILLED_CONFIRMED: 다음 달 결제 막기와 환불 요청 템플릿 보기 [S32]', () => {
    expect(labelsFor('BILLED_CONFIRMED')).toEqual(['다음 달 결제 막기', '환불 요청 템플릿 보기']);
  });

  it('환불 요청 템플릿 보기는 확인 없이 화면으로 이동하는 링크이고 파란 버튼이 아니다', () => {
    const refund = presentActions('BILLED_CONFIRMED', SERVER_ACTIONS.BILLED_CONFIRMED).find(
      (a) => a.action === 'VIEW_REFUND_TEMPLATE',
    );
    expect(refund).toMatchObject({ kind: 'refund', primary: false, confirm: null });
  });

  it('종료 상태는 버튼이 없다', () => {
    expect(labelsFor('CANCELED_CONFIRMED')).toEqual([]);
    expect(labelsFor('KEPT')).toEqual([]);
    expect(labelsFor('VOIDED')).toEqual([]);
  });

  it('서버가 주지 않은 버튼은 만들지 않는다', () => {
    expect(presentActions('TRACKING', ['KEEP']).map((a) => a.action)).toEqual(['KEEP']);
  });

  it('해지 브릿지로 가는 버튼은 이동 링크이고 나머지는 확인을 거치는 명령이다', () => {
    const tracking = presentActions('TRACKING', SERVER_ACTIONS.TRACKING);
    expect(tracking.map((a) => a.kind)).toEqual(['bridge', 'command', 'command']);
    expect(tracking[0]).toMatchObject({ action: 'GO_TO_BRIDGE', confirm: null });
    expect(tracking[1]?.confirm).toMatchObject({
      title: '계속 쓰기로 할까요?',
      button: '계속 쓸래요',
    });
    expect(tracking[2]?.confirm).toMatchObject({
      title: '등록을 취소할까요?',
      button: '등록 취소',
    });
  });

  it('상태마다 파란 주요 버튼은 많아야 하나다', () => {
    for (const status of Object.keys(SERVER_ACTIONS) as Status[]) {
      const primary = presentActions(status, SERVER_ACTIONS[status]).filter((a) => a.primary);
      expect(primary.length, status).toBeLessThanOrEqual(1);
    }
  });

  it('주요 버튼: TRACKING은 해지하러 가기, CANCEL_ATTEMPTED는 해지 완료했어요', () => {
    expect(presentActions('TRACKING', SERVER_ACTIONS.TRACKING).find((a) => a.primary)?.action).toBe(
      'GO_TO_BRIDGE',
    );
    expect(
      presentActions('CANCEL_ATTEMPTED', SERVER_ACTIONS.CANCEL_ATTEMPTED).find((a) => a.primary)
        ?.action,
    ).toBe('CONFIRM_CANCEL');
  });
});

describe('ExitPoll 응답이 필요한 행동 [T27][S28][S31]', () => {
  it('직접 해지 확정: 아직 응답이 없으면 필요하다', () => {
    expect(exitReasonRequired('CONFIRM_CANCEL', {})).toBe(true);
  });

  it('해지 브릿지에서 사유를 고른 기록의 해지 확정은 다시 묻지 않는다', () => {
    expect(exitReasonRequired('CONFIRM_CANCEL', { exitReason: 'PRICE_BURDEN' })).toBe(false);
  });

  it('결제 전에 해지했어요: 응답이 없을 때만 필요하다 (S31)', () => {
    expect(exitReasonRequired('RESOLVE_CANCELED_BEFORE_BILLING', {})).toBe(true);
    expect(
      exitReasonRequired('RESOLVE_CANCELED_BEFORE_BILLING', { exitReason: 'COMPLEX_UX' }),
    ).toBe(false);
  });

  it('유지·등록 취소·결제됐어요는 응답이 필요 없다', () => {
    expect(exitReasonRequired('KEEP', {})).toBe(false);
    expect(exitReasonRequired('VOID', {})).toBe(false);
    expect(exitReasonRequired('RESOLVE_BILLED', {})).toBe(false);
    expect(exitReasonRequired('RESOLVE_KEEP_USING', {})).toBe(false);
  });
});

describe('기록 수정·직접 해지 진입 [T27][S42][S28]', () => {
  it('날짜 수정은 TRACKING·CANCEL_ATTEMPTED에서만 열린다 (SPEC §5)', () => {
    expect(canEdit('TRACKING')).toBe(true);
    expect(canEdit('CANCEL_ATTEMPTED')).toBe(true);
    for (const status of [
      'MISSED_BILLED',
      'BILLED_CONFIRMED',
      'CANCELED_CONFIRMED',
      'KEPT',
      'VOIDED',
    ] as const) {
      expect(canEdit(status), status).toBe(false);
    }
  });

  it("'이미 직접 해지했어요'는 TRACKING 상세에서만 열린다 (사유 선택을 거친다)", () => {
    expect(canDirectCancel('TRACKING')).toBe(true);
    for (const status of [
      'CANCEL_ATTEMPTED',
      'MISSED_BILLED',
      'BILLED_CONFIRMED',
      'CANCELED_CONFIRMED',
      'KEPT',
      'VOIDED',
    ] as const) {
      expect(canDirectCancel(status), status).toBe(false);
    }
  });
});
