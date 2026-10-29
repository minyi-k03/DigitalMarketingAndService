import { describe, expect, it } from 'vitest';
import {
  addDays,
  kstAt,
  kstDateOf,
  parseKstDate,
  todayKst,
  type KstDate,
} from '../../src/shared/kst-date';
import { FakeClock } from '../support/fake-clock';

const d = (s: string) => parseKstDate(s);

describe('KstDate 일 단위 연산 [SPEC §4, T02]', () => {
  it.each([
    ['월말', '2026-01-31', 1, '2026-02-01'],
    ['연말', '2026-12-31', 1, '2027-01-01'],
    ['윤년 2/28', '2028-02-28', 1, '2028-02-29'],
    ['윤년 2/29', '2028-02-29', 1, '2028-03-01'],
    ['평년 2/28', '2027-02-28', 1, '2027-03-01'],
    ['100의 배수 평년(2100)', '2100-02-28', 1, '2100-03-01'],
    ['400의 배수 윤년(2000)', '2000-02-28', 1, '2000-02-29'],
    ['뺄셈: 윤년 3/1', '2028-03-01', -1, '2028-02-29'],
    ['뺄셈: 평년 3/1', '2027-03-01', -1, '2027-02-28'],
    ['뺄셈: 연초', '2027-01-01', -1, '2026-12-31'],
    ['0일', '2026-05-17', 0, '2026-05-17'],
    ['365일(평년)', '2026-12-09', 365, '2027-12-09'],
    ['365일(윤일 포함)', '2027-12-09', 365, '2028-12-08'],
  ])('addDays: %s', (_name, start, n, expected) => {
    expect(addDays(d(start), n)).toBe(expected);
  });

  it('parseKstDate는 존재하지 않는 날짜와 잘못된 형식을 거부한다', () => {
    for (const bad of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-1-1',
      'abc',
      '',
    ]) {
      expect(() => parseKstDate(bad), bad).toThrow();
    }
  });
});

describe('todayKst [SPEC §4]', () => {
  it.each([
    ['KST 00:00 정각 (UTC 전날 15:00)', '2026-12-08T15:00:00.000Z', '2026-12-09'],
    ['KST 08:59:59 (UTC 전날 23:59:59)', '2026-12-08T23:59:59.000Z', '2026-12-09'],
    ['KST 09:00 (UTC 당일 00:00)', '2026-12-09T00:00:00.000Z', '2026-12-09'],
    ['KST 23:59:59.999 (UTC 14:59:59.999)', '2026-12-09T14:59:59.999Z', '2026-12-09'],
    ['KST 전날 23:59:59.999 (UTC 전날 14:59:59.999)', '2026-12-08T14:59:59.999Z', '2026-12-08'],
    ['연말 경계 (UTC 12/31 15:00 = KST 1/1 00:00)', '2026-12-31T15:00:00.000Z', '2027-01-01'],
  ])('%s', (_name, now, expected) => {
    expect(todayKst(new FakeClock(now))).toBe(expected);
  });

  it('Clock이 진행하면 날짜도 따라 바뀐다', () => {
    const clock = new FakeClock('2026-12-09T14:59:59.000Z');
    expect(todayKst(clock)).toBe('2026-12-09');
    clock.advanceBy(1000);
    expect(todayKst(clock)).toBe('2026-12-10');
  });
});

describe('kstAt / kstDateOf [SPEC §4, §6]', () => {
  it.each([
    ['2026-12-09', '10:00', '2026-12-09T01:00:00.000Z'],
    ['2026-12-09', '20:00', '2026-12-09T11:00:00.000Z'],
    ['2026-12-09', '21:00', '2026-12-09T12:00:00.000Z'],
    ['2026-12-09', '00:00', '2026-12-08T15:00:00.000Z'],
    ['2027-01-01', '08:59', '2026-12-31T23:59:00.000Z'],
    ['2026-12-09', '23:59', '2026-12-09T14:59:00.000Z'],
  ])('kstAt(%s, %s)', (date, hhmm, expected) => {
    expect(kstAt(d(date), hhmm)).toBe(expected);
  });

  it('kstAt은 잘못된 시각 형식을 거부한다', () => {
    for (const bad of ['24:00', '9:00', '10:60', '1000', '']) {
      expect(() => kstAt(d('2026-12-09'), bad), bad).toThrow();
    }
  });

  it('kstDateOf는 UTC 시각의 KST 날짜를 돌려준다', () => {
    expect(kstDateOf(kstAt(d('2026-12-09'), '00:00'))).toBe('2026-12-09');
    expect(kstDateOf('2026-12-08T14:59:59.999Z' as never)).toBe('2026-12-08');
    expect(kstDateOf('2026-12-09T15:00:00.000Z' as never)).toBe('2026-12-10');
  });

  it('kstDateOf는 잘못된 시각 문자열을 거부한다', () => {
    expect(() => kstDateOf('not-a-date' as never)).toThrow();
  });
});

describe('SafeEndDate 당일 23:59:59 KST 판정 [SPEC §8, T02]', () => {
  const safeEndDate: KstDate = d('2026-12-09');
  const withinDeadline = (confirmedAt: string) => kstDateOf(confirmedAt as never) <= safeEndDate;

  it('SafeEndDate 당일 23:59:59 KST는 마감 이내다', () => {
    expect(withinDeadline('2026-12-09T14:59:59.000Z')).toBe(true);
  });

  it('다음 날 00:00:00 KST는 마감을 넘긴다', () => {
    expect(withinDeadline('2026-12-09T15:00:00.000Z')).toBe(false);
  });

  it('SafeEndDate 전날은 마감 이내다', () => {
    expect(withinDeadline('2026-12-08T15:00:00.000Z')).toBe(true);
  });
});
