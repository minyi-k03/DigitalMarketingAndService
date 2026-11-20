import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { summaryLine } from '../../src/web/trials/summary';

type Status = components['schemas']['TrialStatus'];

function record(status: Status, savedAmount: number | null = null) {
  return {
    status,
    startDate: '2026-11-10',
    billingDate: '2026-11-17',
    safeEndDate: '2026-11-16',
    savedAmount,
  };
}

describe('내 체험 카드 안내 문구 [T27][S30][S41]', () => {
  it('추적 중·해지 진행 중은 안전 만료일을 알려 준다', () => {
    expect(summaryLine(record('TRACKING'))).toBe('안전 만료일 2026-11-16');
    expect(summaryLine(record('CANCEL_ATTEMPTED'))).toBe('안전 만료일 2026-11-16');
  });

  it('결제 확인이 필요한 기록은 결제 예정일이 지났다고 알리고 응답을 청한다', () => {
    expect(summaryLine(record('MISSED_BILLED'))).toBe(
      '결제 예정일(2026-11-17)이 지났어요. 실제로 어떻게 됐는지 알려 주세요.',
    );
  });

  it('안전 만료일 안에 해지를 확정해 방어한 금액이 있으면 금액을 알려 준다', () => {
    expect(summaryLine(record('CANCELED_CONFIRMED', 9900))).toBe('9,900원을 지켰어요');
  });

  it('0원 항목을 기한 안에 해지해도 방어한 금액으로 알린다 (monthlyPrice는 0 이상, SPEC §8)', () => {
    expect(summaryLine(record('CANCELED_CONFIRMED', 0))).toBe('0원을 지켰어요');
  });

  it('방어한 금액이 없으면(안전 만료일 뒤 확정) 그렇게 알린다', () => {
    expect(summaryLine(record('CANCELED_CONFIRMED', null))).toBe(
      '안전 만료일 뒤에 해지를 확정했어요',
    );
  });

  it('그 밖의 종료 상태는 시작일을 보여 준다', () => {
    expect(summaryLine(record('KEPT'))).toBe('시작일 2026-11-10');
    expect(summaryLine(record('VOIDED'))).toBe('시작일 2026-11-10');
    expect(summaryLine(record('BILLED_CONFIRMED'))).toBe('시작일 2026-11-10');
  });
});
