import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../src/web/api/response';
import { describeCommandError } from '../../src/web/trials/command-error';

function error(code: ApiError['code'], status = 409): ApiError {
  return { status, code, title: code };
}

describe('체험 기록 명령 실패 안내 [T27][S10][S28][S29][S31][S42]', () => {
  it('이미 다른 곳에서 상태가 바뀌었으면 닫을 때 최신 상태를 보여 준다고 안내한다 (INVALID_TRANSITION)', () => {
    // 안내를 보이는 동안 목록을 먼저 새로 불러오면 카드가 사라져 안내도 함께 사라진다.
    // 그래서 새로 불러오는 시점은 시트를 닫을 때이고, 문구도 그 순서를 따른다.
    expect(describeCommandError(error('INVALID_TRANSITION'))).toEqual({
      title: '이미 상태가 바뀐 체험이에요',
      detail: '다른 곳에서 먼저 처리됐어요. 닫으면 최신 상태를 보여 드려요.',
      stale: true,
    });
  });

  it('동시에 수정이 겹친 경우도 새로 불러온다 (CONFLICT)', () => {
    expect(describeCommandError(error('CONFLICT')).stale).toBe(true);
  });

  it('ExitPoll 사유가 빠졌으면 사유를 고르라고 안내하고 목록은 새로 불러오지 않는다', () => {
    expect(describeCommandError(error('EXIT_POLL_REQUIRED', 422))).toEqual({
      title: '해지 이유를 골라 주세요',
      detail: '한 가지만 고르면 바로 처리돼요.',
      stale: false,
    });
  });

  it('결제 예정일이 지난 기록은 날짜를 수정할 수 없다고 안내한다', () => {
    expect(describeCommandError(error('TRIAL_ALREADY_ENDED', 422))).toEqual({
      title: '이미 끝난 체험이에요',
      detail: '결제 예정일이 지났어요. 시작일이나 체험 일수를 다시 확인해 주세요.',
      stale: false,
    });
  });

  it('잘못된 입력은 입력을 확인하라고 안내한다', () => {
    expect(describeCommandError(error('VALIDATION_FAILED', 400))).toEqual({
      title: '입력을 확인해 주세요',
      detail: '시작일이나 체험 일수가 올바르지 않아요.',
      stale: false,
    });
  });

  it('없는 기록이거나 남의 기록이면 찾을 수 없다고 안내한다', () => {
    expect(describeCommandError(error('NOT_FOUND', 404))).toEqual({
      title: '체험을 찾을 수 없어요',
      detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
      stale: false,
    });
  });

  it('알 수 없는 오류는 서버 문구를 노출하지 않고 다시 시도하라고 안내한다', () => {
    const result = describeCommandError({
      status: 500,
      code: 'INTERNAL_ERROR',
      title: 'boom',
      detail: 'SQLITE_ERROR: secret',
    });
    expect(result).toEqual({
      title: '처리하지 못했어요',
      detail: '잠시 뒤 다시 시도해 주세요.',
      stale: false,
    });
  });
});
