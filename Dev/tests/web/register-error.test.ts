import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../src/web/api/response';
import { describeRegisterError } from '../../src/web/catalog/register-error';

function error(code: ApiError['code'], extra: Partial<ApiError> = {}): ApiError {
  return { status: 400, code, title: code, ...extra };
}

describe('체험 등록 실패 안내 [T26][S7][S8][V-08]', () => {
  it('이미 진행 중인 기록이 있으면 새로 만들지 않고 기존 기록으로 안내한다 (SPEC §3)', () => {
    const result = describeRegisterError(
      error('DUPLICATE_ACTIVE_RECORD', { status: 409, existingTrialRecordId: 'tr_1' }),
    );

    expect(result).toEqual({ kind: 'duplicate', existingTrialRecordId: 'tr_1' });
  });

  it('기존 기록 ID가 없어도 중복으로 안내한다', () => {
    const result = describeRegisterError(error('DUPLICATE_ACTIVE_RECORD', { status: 409 }));

    expect(result).toEqual({ kind: 'duplicate', existingTrialRecordId: undefined });
  });

  it('게시 중단 항목은 새로 추적할 수 없다고 안내한다 (V-08)', () => {
    const result = describeRegisterError(error('CATALOG_ITEM_NOT_PUBLISHED', { status: 422 }));

    expect(result).toEqual({
      kind: 'notice',
      title: '게시가 중단된 서비스예요',
      detail: '새로 추적할 수 없어요. 이미 추적 중이면 알림은 계속 받아요.',
    });
  });

  it('결제 예정일이 지난 체험은 시작일을 다시 확인하라고 안내한다', () => {
    const result = describeRegisterError(error('TRIAL_ALREADY_ENDED', { status: 422 }));

    expect(result).toEqual({
      kind: 'notice',
      title: '이미 끝난 체험이에요',
      detail: '결제 예정일이 지났어요. 시작일을 다시 확인해 주세요.',
    });
  });

  it('입력 검증 실패는 서버의 내부 문구를 그대로 보여 주지 않고 고칠 방법을 안내한다', () => {
    const result = describeRegisterError(
      error('VALIDATION_FAILED', { errors: [{ field: 'startDate', message: 'must be <= today' }] }),
    );

    expect(result).toEqual({
      kind: 'notice',
      title: '입력을 확인해 주세요',
      detail: '시작일이나 체험 일수가 올바르지 않아요.',
    });
  });

  it('서비스가 없으면 목록에서 다시 고르라고 안내한다', () => {
    const result = describeRegisterError(error('NOT_FOUND', { status: 404 }));

    expect(result).toEqual({
      kind: 'notice',
      title: '서비스를 찾을 수 없어요',
      detail: '목록으로 돌아가 다시 선택해 주세요.',
    });
  });

  it('그 밖의 오류는 다시 시도하라고만 안내한다', () => {
    const result = describeRegisterError(error('INTERNAL_ERROR', { status: 500 }));

    expect(result).toEqual({
      kind: 'notice',
      title: '등록하지 못했어요',
      detail: '잠시 뒤 다시 시도해 주세요.',
    });
  });
});
