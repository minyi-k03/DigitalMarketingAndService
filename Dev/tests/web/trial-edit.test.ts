import { describe, expect, it } from 'vitest';
import { buildUpdateRequest } from '../../src/web/trials/edit-request';

const record = { startDate: '2026-11-10', trialDays: 30 };

describe('체험 기록 수정 요청 만들기 [T27][S42]', () => {
  it('바뀐 필드만 보낸다 (시작일만)', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-12', trialDays: '30' })).toEqual({
      ok: true,
      body: { startDate: '2026-11-12' },
    });
  });

  it('바뀐 필드만 보낸다 (체험 일수만)', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '14' })).toEqual({
      ok: true,
      body: { trialDays: 14 },
    });
  });

  it('둘 다 바뀌면 둘 다 보낸다', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-01', trialDays: '7' })).toEqual({
      ok: true,
      body: { startDate: '2026-11-01', trialDays: 7 },
    });
  });

  it('아무것도 바뀌지 않았으면 보내지 않는다 (서버는 빈 본문을 거부한다)', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '30' })).toEqual({
      ok: false,
      reason: 'UNCHANGED',
    });
  });

  it('체험 일수는 1~365의 정수여야 한다', () => {
    for (const days of ['', '0', '-3', '366', '1.5', 'abc', '3e1']) {
      expect(
        buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: days }),
        `"${days}"`,
      ).toEqual({ ok: false, reason: 'TRIAL_DAYS_INVALID' });
    }
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '1' })).toEqual({
      ok: true,
      body: { trialDays: 1 },
    });
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '365' })).toEqual({
      ok: true,
      body: { trialDays: 365 },
    });
  });

  it('앞자리 0은 숫자 값으로 읽는다 (0365는 365, 007은 7)', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '0365' })).toEqual({
      ok: true,
      body: { trialDays: 365 },
    });
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '007' })).toEqual({
      ok: true,
      body: { trialDays: 7 },
    });
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '0366' })).toEqual({
      ok: false,
      reason: 'TRIAL_DAYS_INVALID',
    });
  });

  it('아주 긴 숫자는 범위를 벗어난 값으로 거부한다', () => {
    expect(
      buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: '9'.repeat(400) }),
    ).toEqual({ ok: false, reason: 'TRIAL_DAYS_INVALID' });
  });

  it('체험 일수 앞뒤 공백은 무시한다', () => {
    expect(buildUpdateRequest(record, { startDate: '2026-11-10', trialDays: ' 14 ' })).toEqual({
      ok: true,
      body: { trialDays: 14 },
    });
  });
});
