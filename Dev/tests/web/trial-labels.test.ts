import { describe, expect, it } from 'vitest';
import type { components } from '../../src/shared/api-types';
import { EXIT_REASONS, exitReasonLabel, statusBadge } from '../../src/web/trials/labels';
import { parseTab, tabSearch } from '../../src/web/trials/tab';

type Status = components['schemas']['TrialStatus'];

describe('내 체험 탭 주소 [T27][S41]', () => {
  it('쿼리가 없으면 진행 중 탭이다', () => {
    expect(parseTab('')).toBe('ACTIVE');
    expect(parseTab('?tab=active')).toBe('ACTIVE');
  });

  it('?tab=past는 지난 체험 탭이다', () => {
    expect(parseTab('?tab=past')).toBe('PAST');
  });

  it('알 수 없는 값은 진행 중 탭으로 돌아간다', () => {
    expect(parseTab('?tab=whatever')).toBe('ACTIVE');
  });

  it('진행 중 탭은 쿼리를 붙이지 않고 지난 체험만 붙인다', () => {
    expect(tabSearch('ACTIVE')).toBe('');
    expect(tabSearch('PAST')).toBe('?tab=past');
  });
});

describe('상태 배지 [T27][S41]', () => {
  const EXPECTED: Record<Status, string> = {
    TRACKING: '추적 중',
    CANCEL_ATTEMPTED: '해지 진행 중',
    MISSED_BILLED: '결제 확인 필요',
    CANCELED_CONFIRMED: '해지 완료',
    KEPT: '계속 이용',
    VOIDED: '등록 취소',
    BILLED_CONFIRMED: '결제됨',
  };

  it('7개 상태 모두 글자 라벨이 있다 (색만으로 구분하지 않는다)', () => {
    for (const status of Object.keys(EXPECTED) as Status[]) {
      expect(statusBadge(status).text, status).toBe(EXPECTED[status]);
    }
  });

  it('응답이 필요한 MISSED_BILLED만 경고 톤이다', () => {
    expect(statusBadge('MISSED_BILLED').tone).toBe('warn');
    for (const status of Object.keys(EXPECTED) as Status[]) {
      if (status !== 'MISSED_BILLED') expect(statusBadge(status).tone, status).toBe('plain');
    }
  });
});

describe('ExitPoll 사유 라벨 [T27][S28]', () => {
  it('SPEC §19의 5개 사유를 같은 순서로 보여 준다', () => {
    expect(EXIT_REASONS.map((r) => exitReasonLabel(r))).toEqual([
      '가격 부담',
      '기능·성능 부족',
      '사용성·UI 복잡',
      '단기 목적 달성',
      '대체 서비스 이동',
    ]);
  });
});
