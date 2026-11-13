import { describe, expect, it } from 'vitest';
import { parseKstDate } from '../../src/shared/kst-date';
import { previewTrialPlan, startDateMessage } from '../../src/web/catalog/trial-plan';

const today = parseKstDate('2026-11-13');

describe('카탈로그 등록 시작일 미리보기 [T26][S8][S11][S12]', () => {
  it('국내 항목은 결제 예정일이 곧 안전 만료일이다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-11-13',
      trialDays: 30,
      bufferApplied: false,
      today,
    });

    expect(plan).toEqual({ ok: true, billingDate: '2026-12-13', safeEndDate: '2026-12-13' });
  });

  it('글로벌 항목은 안전 만료일이 결제 예정일보다 하루 빠르다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-11-13',
      trialDays: 7,
      bufferApplied: true,
      today,
    });

    expect(plan).toEqual({ ok: true, billingDate: '2026-11-20', safeEndDate: '2026-11-19' });
  });

  it('월말·연말을 넘기는 체험 일수도 달력 날짜로 계산한다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-12-31',
      trialDays: 30,
      bufferApplied: true,
      today: parseKstDate('2026-12-31'),
    });

    expect(plan).toEqual({ ok: true, billingDate: '2027-01-30', safeEndDate: '2027-01-29' });
  });

  it('윤년 2월 29일을 지난다', () => {
    const plan = previewTrialPlan({
      startDate: '2028-02-20',
      trialDays: 10,
      bufferApplied: false,
      today: parseKstDate('2028-02-20'),
    });

    expect(plan).toEqual({ ok: true, billingDate: '2028-03-01', safeEndDate: '2028-03-01' });
  });

  it('이미 며칠 전에 시작한 체험도 결제 예정일이 오늘 이후면 허용한다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-11-03',
      trialDays: 14,
      bufferApplied: false,
      today,
    });

    expect(plan).toEqual({ ok: true, billingDate: '2026-11-17', safeEndDate: '2026-11-17' });
  });

  it('결제 예정일이 오늘이면 등록할 수 있다 (SPEC §3 입력 검증은 오늘보다 이전일 때만 거부)', () => {
    const plan = previewTrialPlan({
      startDate: '2026-10-30',
      trialDays: 14,
      bufferApplied: true,
      today,
    });

    expect(plan).toEqual({ ok: true, billingDate: '2026-11-13', safeEndDate: '2026-11-12' });
  });

  it('시작일이 오늘 이후면 FUTURE로 거부한다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-11-14',
      trialDays: 30,
      bufferApplied: false,
      today,
    });

    expect(plan).toEqual({ ok: false, reason: 'FUTURE' });
  });

  it('결제 예정일이 오늘보다 이전이면 이미 끝난 체험(ENDED)으로 거부한다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-10-01',
      trialDays: 7,
      bufferApplied: false,
      today,
    });

    expect(plan).toEqual({ ok: false, reason: 'ENDED' });
  });

  it('결제 예정일이 어제면(오늘 하루 차이) 이미 끝난 체험으로 거부한다', () => {
    const plan = previewTrialPlan({
      startDate: '2026-10-29',
      trialDays: 14,
      bufferApplied: false,
      today,
    });

    expect(plan).toEqual({ ok: false, reason: 'ENDED' });
  });

  it.each(['', '2026-13-01', '2026-02-30', '26-11-13', 'abc'])(
    '날짜 형식이 아니거나 없는 날짜(%s)는 INVALID로 거부한다',
    (startDate) => {
      const plan = previewTrialPlan({ startDate, trialDays: 30, bufferApplied: false, today });

      expect(plan).toEqual({ ok: false, reason: 'INVALID' });
    },
  );

  it('거부 사유마다 사용자에게 보일 안내 문구가 있다', () => {
    expect(startDateMessage('INVALID')).toBe('시작일을 날짜 형식으로 입력해 주세요.');
    expect(startDateMessage('FUTURE')).toBe('시작일은 오늘 이후로 정할 수 없어요.');
    expect(startDateMessage('ENDED')).toBe('이미 끝난 체험이에요. 결제 예정일이 지났어요.');
  });
});
