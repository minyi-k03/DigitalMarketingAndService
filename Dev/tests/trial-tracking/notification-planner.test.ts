import { describe, expect, it } from 'vitest';
import { parseKstDate, type UtcInstant } from '../../src/shared/kst-date';
import {
  planCancelConfirmSlots,
  planInitialSlots,
  templateKeyFor,
} from '../../src/worker/modules/trial-tracking/domain/notification-planner';

const d = (s: string) => parseKstDate(s);
const at = (s: string) => s as UtcInstant;

// 글로벌 항목: 결제 예정일 12/10, 안전 만료일 12/9 (bufferApplied)
const globalRecord = {
  billingDate: d('2026-12-10'),
  safeEndDate: d('2026-12-09'),
  bufferApplied: true,
};
// 국내 항목: 안전 만료일 = 결제 예정일 12/10
const domesticRecord = {
  billingDate: d('2026-12-10'),
  safeEndDate: d('2026-12-10'),
  bufferApplied: false,
};
const settings = { sendTime: '10:00' };

describe('TT 알림 계획기 정규 슬롯 D-3·D-1 [S13]', () => {
  it('충분히 앞선 등록은 D3·D1 탈출 알림을 안전 만료일 기준 발송 시각에 계획한다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-01T00:00:00.000Z'), settings);

    expect(slots).toEqual([
      {
        kind: 'ESCAPE_ALERT',
        slot: 'D3',
        variant: 'REGULAR',
        safeEndDate: '2026-12-09',
        sendAt: '2026-12-06T01:00:00.000Z', // 12/6 10:00 KST
      },
      {
        kind: 'ESCAPE_ALERT',
        slot: 'D1',
        variant: 'REGULAR',
        safeEndDate: '2026-12-09',
        sendAt: '2026-12-08T01:00:00.000Z', // 12/8 10:00 KST
      },
    ]);
  });

  it('D3 발송 시각이 지났으면 D1만 계획한다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-06T01:00:01.000Z'), settings);

    expect(slots.map((s) => s.slot)).toEqual(['D1']);
  });

  it('발송 시각과 정확히 같은 시각의 등록은 그 슬롯이 지난 것으로 본다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-06T01:00:00.000Z'), settings);

    expect(slots.map((s) => s.slot)).toEqual(['D1']);
  });

  it('D1 발송 시각과 정확히 같은 시각의 등록은 D1이 지나 늦은 등록이 된다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-08T01:00:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.variant])).toEqual([['LATE_REGISTRATION', 'REGULAR']]);
  });

  it('연말을 넘는 안전 만료일도 일 단위로 D3를 계산한다', () => {
    const record = { ...globalRecord, safeEndDate: d('2027-01-02'), billingDate: d('2027-01-03') };

    const slots = planInitialSlots(record, at('2026-12-01T00:00:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.sendAt])).toEqual([
      ['D3', '2026-12-30T01:00:00.000Z'],
      ['D1', '2027-01-01T01:00:00.000Z'],
    ]);
  });

  it('운영 설정의 발송 시각을 슬롯 시각에 쓴다 [G5]', () => {
    const slots = planInitialSlots(
      globalRecord,
      at('2026-12-01T00:00:00.000Z'),
      { sendTime: '09:30' },
    );

    expect(slots.map((s) => s.sendAt)).toEqual([
      '2026-12-06T00:30:00.000Z',
      '2026-12-08T00:30:00.000Z',
    ]);
  });
});

describe('TT 늦은 등록 즉시 알림·문구 분기 [S15]', () => {
  // D1 발송 시각(12/8 10:00 KST) 이후 등록
  it('D1 시각 이후 등록은 일반 문구로 즉시 1회 계획한다', () => {
    const now = at('2026-12-08T02:00:00.000Z'); // 12/8 11:00 KST, 오늘 < 안전 만료일

    expect(planInitialSlots(globalRecord, now, settings)).toEqual([
      {
        kind: 'ESCAPE_ALERT',
        slot: 'LATE_REGISTRATION',
        variant: 'REGULAR',
        safeEndDate: '2026-12-09',
        sendAt: now,
      },
    ]);
  });

  it('글로벌 항목 안전 만료일 당일 등록은 마지막 날 문구다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-09T03:00:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.variant])).toEqual([
      ['LATE_REGISTRATION', 'LATE_SAFE_END_DAY'],
    ]);
  });

  it('글로벌 항목 결제 예정일 당일 등록은 오늘 결제 경고 문구다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-10T03:00:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.variant])).toEqual([
      ['LATE_REGISTRATION', 'LATE_BILLING_DAY'],
    ]);
  });

  it('국내 항목은 안전 만료일 당일 등록도 오늘 결제 경고 문구다', () => {
    const slots = planInitialSlots(domesticRecord, at('2026-12-10T03:00:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.variant])).toEqual([
      ['LATE_REGISTRATION', 'LATE_BILLING_DAY'],
    ]);
  });

  it('결제 예정일이 지난 뒤에는 어떤 알림도 계획하지 않는다', () => {
    const slots = planInitialSlots(globalRecord, at('2026-12-10T15:00:00.000Z'), settings); // 12/11 00:00 KST

    expect(slots).toEqual([]);
  });

  it('KST 00:00~08:59(UTC 전날) 등록의 오늘은 KST 날짜로 판단한다', () => {
    // UTC로는 12/8 23:30이지만 KST로는 12/9 08:30 = 안전 만료일 당일
    const slots = planInitialSlots(globalRecord, at('2026-12-08T23:30:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.variant])).toEqual([
      ['LATE_REGISTRATION', 'LATE_SAFE_END_DAY'],
    ]);
  });
});

describe('TT 해지 확인 알림 D1_CONFIRM [S26]', () => {
  it('D1 발송 시각 이전의 해지 시도는 D1을 해지 확인 알림으로 교체한 슬롯 하나를 계획한다', () => {
    const slots = planCancelConfirmSlots(globalRecord, at('2026-12-07T05:00:00.000Z'), settings);

    expect(slots).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'D1_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-12-09',
        sendAt: '2026-12-08T01:00:00.000Z', // 12/8 10:00 KST
      },
    ]);
  });

  it('D1 발송 시각과 정확히 같은 시각의 시도는 D1이 지난 것으로 보고 당일 확인으로 간다', () => {
    const slots = planCancelConfirmSlots(globalRecord, at('2026-12-08T01:00:00.000Z'), settings);

    expect(slots.map((s) => s.slot)).toEqual(['SAME_DAY_CONFIRM']);
  });

  it('운영 설정의 발송 시각이 D1_CONFIRM의 시각과 D1 경과 판단에 쓰인다 [G5]', () => {
    const early = { sendTime: '09:30' };

    // 12/8 09:45 KST: 09:30 설정이면 D1 시각이 지났다(10:00 기본값이면 아직 안 지남)
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-08T00:45:00.000Z'), early).map((s) => s.slot),
    ).toEqual(['SAME_DAY_CONFIRM']);
    // 그 전 시도는 09:30 설정의 D1 시각에 보낸다
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-07T05:00:00.000Z'), early).map((s) => [
        s.slot,
        s.sendAt,
      ]),
    ).toEqual([['D1_CONFIRM', '2026-12-08T00:30:00.000Z']]);
  });

  it('발송 시각을 20:00으로 바꿔도 글로벌 당일 확인 마감은 20:00으로 고정이다 [G5]', () => {
    const late = { sendTime: '20:00' };
    // 12/8 19:00 KST: D1 시각(12/8 20:00) 이전이라 D1_CONFIRM
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-08T10:00:00.000Z'), late).map((s) => s.slot),
    ).toEqual(['D1_CONFIRM']);
    // 12/8 21:00 KST: D1 이후, 당일 마감은 설정과 무관하게 12/9 20:00
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-08T12:00:00.000Z'), late).map((s) => [
        s.slot,
        s.sendAt,
      ]),
    ).toEqual([['SAME_DAY_CONFIRM', '2026-12-09T11:00:00.000Z']]);
  });

  it('국내 항목도 D1 발송 시각 이전이면 같은 D1_CONFIRM이다', () => {
    const slots = planCancelConfirmSlots(domesticRecord, at('2026-12-09T00:00:00.000Z'), settings); // 12/9 09:00 KST

    expect(slots.map((s) => [s.slot, s.sendAt])).toEqual([
      ['D1_CONFIRM', '2026-12-09T01:00:00.000Z'],
    ]);
  });
});

describe('TT 글로벌 항목 당일 해지 확인 알림 [S27]', () => {
  it('D1 시각 이후 시도는 안전 만료일 당일 20:00 KST에 보낸다', () => {
    const slots = planCancelConfirmSlots(globalRecord, at('2026-12-08T02:00:00.000Z'), settings); // 12/8 11:00 KST

    expect(slots).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'SAME_DAY_CONFIRM',
        variant: 'REGULAR',
        safeEndDate: '2026-12-09',
        sendAt: '2026-12-09T11:00:00.000Z', // 12/9 20:00 KST
      },
    ]);
  });

  it('당일 19:59 시도도 20:00에 보낸다', () => {
    const slots = planCancelConfirmSlots(globalRecord, at('2026-12-09T10:59:00.000Z'), settings);

    expect(slots.map((s) => [s.slot, s.sendAt])).toEqual([
      ['SAME_DAY_CONFIRM', '2026-12-09T11:00:00.000Z'],
    ]);
  });

  it('당일 20:00 이후 시도는 추가 알림 없이 결제 확인 흐름으로 이어진다', () => {
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-09T11:00:00.000Z'), settings),
    ).toEqual([]);
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-09T14:30:00.000Z'), settings),
    ).toEqual([]);
  });

  it('안전 만료일이 지난 뒤의 시도는 알림을 계획하지 않는다', () => {
    expect(
      planCancelConfirmSlots(globalRecord, at('2026-12-10T01:00:00.000Z'), settings),
    ).toEqual([]);
  });
});

describe('TT 국내 항목 당일 해지 확인 알림 [S27]', () => {
  it('안전 만료일 전날(D1 시각 이후) 시도는 당일 기본 발송 시각에 보낸다', () => {
    const slots = planCancelConfirmSlots(domesticRecord, at('2026-12-09T08:00:00.000Z'), settings); // 12/9 17:00 KST

    expect(slots).toEqual([
      {
        kind: 'CANCEL_CONFIRM_CHECK',
        slot: 'SAME_DAY_CONFIRM',
        variant: 'SAME_DAY_DOMESTIC',
        safeEndDate: '2026-12-10',
        sendAt: '2026-12-10T01:00:00.000Z', // 12/10 10:00 KST
      },
    ]);
  });

  it('당일 시도는 시도 시각 1시간 뒤에 보낸다', () => {
    const now = at('2026-12-10T02:30:00.000Z'); // 12/10 11:30 KST

    const slots = planCancelConfirmSlots(domesticRecord, now, settings);

    expect(slots.map((s) => [s.slot, s.variant, s.sendAt])).toEqual([
      ['SAME_DAY_CONFIRM', 'SAME_DAY_DOMESTIC', '2026-12-10T03:30:00.000Z'],
    ]);
  });

  it('당일 이른 새벽(발송 시각 이전) 시도도 시도 시각 1시간 뒤에 보낸다', () => {
    const slots = planCancelConfirmSlots(domesticRecord, at('2026-12-09T18:00:00.000Z'), settings); // 12/10 03:00 KST

    expect(slots.map((s) => s.sendAt)).toEqual(['2026-12-09T19:00:00.000Z']);
  });

  it('당일 20:59 시도는 1시간 뒤(21:59)에 보낸다', () => {
    const slots = planCancelConfirmSlots(domesticRecord, at('2026-12-10T11:59:00.000Z'), settings);

    expect(slots.map((s) => s.sendAt)).toEqual(['2026-12-10T12:59:00.000Z']);
  });

  it('당일 21:00 KST 이후 시도는 알림 없이 결제 확인 흐름으로 이어진다', () => {
    expect(
      planCancelConfirmSlots(domesticRecord, at('2026-12-10T12:00:00.000Z'), settings),
    ).toEqual([]);
    expect(
      planCancelConfirmSlots(domesticRecord, at('2026-12-10T14:00:00.000Z'), settings),
    ).toEqual([]);
  });

  it('안전 만료일 전날 시도의 당일 발송에도 운영 설정 발송 시각을 쓴다 [G5]', () => {
    const slots = planCancelConfirmSlots(
      domesticRecord,
      at('2026-12-09T08:00:00.000Z'),
      { sendTime: '09:30' },
    );

    expect(slots.map((s) => s.sendAt)).toEqual(['2026-12-10T00:30:00.000Z']);
  });
});

describe('TT AccessRetentionPolicy별 문구 분기 [S6][S14]', () => {
  const policies = ['RETAIN_UNTIL_END', 'IMMEDIATE_TERMINATION'] as const;

  it('템플릿 키 형식은 notification.templates 설정의 키와 같은 문자열이다', () => {
    expect(templateKeyFor({ kind: 'ESCAPE_ALERT', variant: 'LATE_BILLING_DAY' }, 'IMMEDIATE_TERMINATION')).toBe(
      'ESCAPE_ALERT.LATE_BILLING_DAY.IMMEDIATE_TERMINATION',
    );
    expect(templateKeyFor({ kind: 'CANCEL_CONFIRM_CHECK', variant: 'SAME_DAY_DOMESTIC' }, 'RETAIN_UNTIL_END')).toBe(
      'CANCEL_CONFIRM_CHECK.SAME_DAY_DOMESTIC',
    );
    expect(templateKeyFor({ kind: 'BILLING_CHECK', variant: 'REGULAR' }, 'IMMEDIATE_TERMINATION')).toBe(
      'BILLING_CHECK.REGULAR',
    );
  });

  it('탈출 알림은 변형 3종 × 접근 정책 2종이 모두 서로 다른 템플릿 키다', () => {
    const keys = (['REGULAR', 'LATE_BILLING_DAY', 'LATE_SAFE_END_DAY'] as const).flatMap((variant) =>
      policies.map((policy) => templateKeyFor({ kind: 'ESCAPE_ALERT', variant }, policy)),
    );

    expect(new Set(keys).size).toBe(6);
  });

  it('같은 변형이라도 접근 정책이 다르면 탈출 알림 키가 다르다', () => {
    expect(templateKeyFor({ kind: 'ESCAPE_ALERT', variant: 'REGULAR' }, 'RETAIN_UNTIL_END')).not.toBe(
      templateKeyFor({ kind: 'ESCAPE_ALERT', variant: 'REGULAR' }, 'IMMEDIATE_TERMINATION'),
    );
  });

  it.each([
    [{ kind: 'CANCEL_CONFIRM_CHECK', variant: 'REGULAR' }],
    [{ kind: 'CANCEL_CONFIRM_CHECK', variant: 'SAME_DAY_DOMESTIC' }],
    [{ kind: 'BILLING_CHECK', variant: 'REGULAR' }],
  ] as const)('해지 확인·결제 확인 알림 %o은 접근 정책과 무관하게 같은 키다', (template) => {
    expect(templateKeyFor(template, 'RETAIN_UNTIL_END')).toBe(
      templateKeyFor(template, 'IMMEDIATE_TERMINATION'),
    );
  });

  it('종류와 변형이 다르면 접근 정책이 같아도 키가 다르다', () => {
    const regularConfirm = templateKeyFor(
      { kind: 'CANCEL_CONFIRM_CHECK', variant: 'REGULAR' },
      'RETAIN_UNTIL_END',
    );
    const domesticConfirm = templateKeyFor(
      { kind: 'CANCEL_CONFIRM_CHECK', variant: 'SAME_DAY_DOMESTIC' },
      'RETAIN_UNTIL_END',
    );
    const billingCheck = templateKeyFor(
      { kind: 'BILLING_CHECK', variant: 'REGULAR' },
      'RETAIN_UNTIL_END',
    );

    expect(new Set([regularConfirm, domesticConfirm, billingCheck]).size).toBe(3);
  });

  it('계획된 슬롯을 그대로 템플릿 키 조회에 쓸 수 있다', () => {
    const [slot] = planInitialSlots(globalRecord, at('2026-12-09T03:00:00.000Z'), settings);

    expect(slot && templateKeyFor(slot, 'IMMEDIATE_TERMINATION')).toBe(
      templateKeyFor({ kind: 'ESCAPE_ALERT', variant: 'LATE_SAFE_END_DAY' }, 'IMMEDIATE_TERMINATION'),
    );
  });
});
