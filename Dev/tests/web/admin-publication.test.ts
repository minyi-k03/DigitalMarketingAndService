import { describe, expect, it } from 'vitest';
import { publicationLabel, publicationTransitions } from '../../src/web/admin/publication';

describe('게시 상태 전이 버튼 [T30][S47] (SPEC §2)', () => {
  it('게시 중인 항목은 게시 중단만 할 수 있다', () => {
    expect(publicationTransitions('PUBLISHED')).toEqual([
      { to: 'UNPUBLISHED', label: '게시 중단', confirm: true },
    ]);
  });

  it('검수 대기 항목은 게시 또는 반려할 수 있다', () => {
    expect(publicationTransitions('SUBMITTED').map((t) => t.to)).toEqual(['PUBLISHED', 'REJECTED']);
  });

  it('게시는 바로, 반려는 확인을 거친다', () => {
    expect(publicationTransitions('SUBMITTED')).toEqual([
      { to: 'PUBLISHED', label: '게시', confirm: false },
      { to: 'REJECTED', label: '반려', confirm: true },
    ]);
  });

  it('게시 중단·반려된 항목에는 되돌리는 전이가 없다 (명세에 재게시가 없다)', () => {
    expect(publicationTransitions('UNPUBLISHED')).toEqual([]);
    expect(publicationTransitions('REJECTED')).toEqual([]);
  });

  it('게시 중단은 확인을 거친다 (사용자에게 새 체험 등록이 막히므로)', () => {
    const stop = publicationTransitions('PUBLISHED')[0];
    expect(stop?.confirm).toBe(true);
  });

  it('상태 이름을 한글로 보여 준다', () => {
    expect(publicationLabel('SUBMITTED')).toBe('검수 대기');
    expect(publicationLabel('PUBLISHED')).toBe('게시 중');
    expect(publicationLabel('REJECTED')).toBe('반려');
    expect(publicationLabel('UNPUBLISHED')).toBe('게시 중단');
  });
});
