import { describe, expect, it } from 'vitest';
import { describeAdminError, describeLoadError } from '../../src/web/admin/admin-error';
import {
  parseReportStatusFilter,
  reportActions,
  reportStatusLabel,
  reportTargetLabel,
} from '../../src/web/admin/reports';

describe('경로 오류 제보 목록 표시 [T30][S40]', () => {
  it('제보 대상을 한글로 보여 준다', () => {
    expect(reportTargetLabel('ESCAPE_LINK')).toBe('해지 링크');
    expect(reportTargetLabel('ESCAPE_GUIDE')).toBe('해지 가이드');
  });

  it('처리 상태를 한글로 보여 준다', () => {
    expect(reportStatusLabel('OPEN')).toBe('처리 대기');
    expect(reportStatusLabel('FIXED')).toBe('수정 완료');
    expect(reportStatusLabel('REJECTED')).toBe('반려');
  });

  it('처리 대기 제보만 수정 완료·반려로 처리할 수 있다 (서버는 OPEN으로 되돌리기를 거부한다)', () => {
    expect(reportActions('OPEN')).toEqual([
      { status: 'FIXED', label: '수정 완료' },
      { status: 'REJECTED', label: '반려' },
    ]);
    expect(reportActions('FIXED')).toEqual([]);
    expect(reportActions('REJECTED')).toEqual([]);
  });

  it('상태 필터는 주소의 값이 올바를 때만 쓰고 기본은 처리 대기다', () => {
    expect(parseReportStatusFilter('')).toBe('OPEN');
    expect(parseReportStatusFilter('?status=FIXED')).toBe('FIXED');
    expect(parseReportStatusFilter('?status=ALL')).toBe('ALL');
    expect(parseReportStatusFilter('?status=nope')).toBe('OPEN');
  });
});

describe('관리 API 오류 안내 [T30]', () => {
  it('권한이 없으면 운영자 권한이 필요하다고 알린다', () => {
    expect(describeAdminError({ status: 403, code: 'FORBIDDEN', title: 'x' }).title).toBe(
      '운영자 권한이 필요해요',
    );
  });

  it('게시 상태가 이미 바뀌었으면 최신 상태를 다시 불러오게 한다', () => {
    for (const code of ['INVALID_TRANSITION', 'CONFLICT'] as const) {
      const failure = describeAdminError({ status: 409, code, title: 'x' });
      expect(failure.stale).toBe(true);
    }
  });

  it('입력 오류는 서버가 알려 준 칸별 메시지를 그대로 돌려준다', () => {
    const failure = describeAdminError({
      status: 400,
      code: 'VALIDATION_FAILED',
      title: 'x',
      errors: [{ field: 'supportContact.email', message: '이메일 형식이 아니에요' }],
    });
    expect(failure.fieldErrors).toEqual({ supportContact: '이메일 형식이 아니에요' });
    expect(failure.title).toBe('입력을 확인해 주세요');
  });

  it('목록을 불러오다 403이면 네트워크 문구 대신 권한 안내를 보이고 다시 시도는 숨긴다', () => {
    const fallback = {
      title: '목록을 불러오지 못했어요',
      detail: '네트워크 상태를 확인해 주세요.',
    };
    expect(describeLoadError({ status: 403, code: 'FORBIDDEN', title: 'x' }, fallback)).toEqual({
      title: '운영자 권한이 필요해요',
      detail: '권한이 있는 계정으로 로그인했는지 확인해 주세요.',
      retryable: false,
    });
  });

  it('그 밖의 불러오기 실패는 화면 고유 문구와 다시 시도를 유지한다 (네트워크 실패 포함)', () => {
    const fallback = {
      title: '목록을 불러오지 못했어요',
      detail: '네트워크 상태를 확인해 주세요.',
    };
    expect(describeLoadError({ status: 0, code: 'INTERNAL_ERROR', title: '' }, fallback)).toEqual({
      ...fallback,
      retryable: true,
    });
    expect(
      describeLoadError({ status: 500, code: 'INTERNAL_ERROR', title: 'boom' }, fallback),
    ).toEqual({
      ...fallback,
      retryable: true,
    });
  });

  it('찾을 수 없는 항목과 알 수 없는 오류를 구분하고 서버 내부 문구는 노출하지 않는다', () => {
    expect(describeAdminError({ status: 404, code: 'NOT_FOUND', title: 'x' }).title).toBe(
      '항목을 찾을 수 없어요',
    );
    const unknown = describeAdminError({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'SQLITE_ERROR: boom',
    });
    expect(unknown.title).toBe('처리하지 못했어요');
    expect(JSON.stringify(unknown)).not.toContain('SQLITE');
  });
});
