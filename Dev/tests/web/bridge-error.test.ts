import { describe, expect, it } from 'vitest';
import type { ApiError } from '../../src/web/api/response';
import {
  describeBridgeCommandError,
  describeBridgeLoadError,
  describeBrokenLinkReportError,
} from '../../src/web/bridge/bridge-error';

function error(code: ApiError['code'], status: number): ApiError {
  return { status, code, title: code };
}

describe('해지 브릿지 사유 선택 실패 안내 [T28][S20][S21]', () => {
  it('이미 상태가 바뀌었으면 최신 상태로 바꿔 보여 주겠다고 안내하고 바로 새로 불러온다', () => {
    expect(describeBridgeCommandError(error('INVALID_TRANSITION', 409))).toEqual({
      title: '이미 해지를 시작했거나 상태가 바뀐 체험이에요',
      detail: '다른 곳에서 먼저 처리됐어요. 최신 상태로 바꿔 보여 드려요.',
      refresh: true,
    });
  });

  it('동시에 처리가 겹친 경우도 새로 불러온다 (CONFLICT)', () => {
    expect(describeBridgeCommandError(error('CONFLICT', 409)).refresh).toBe(true);
  });

  it('없는 기록이거나 남의 기록이면 찾을 수 없다고 안내한다', () => {
    expect(describeBridgeCommandError(error('NOT_FOUND', 404))).toEqual({
      title: '체험을 찾을 수 없어요',
      detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
      refresh: false,
    });
  });

  it('알 수 없는 오류는 서버 문구를 노출하지 않고 다시 시도하라고 안내한다', () => {
    expect(
      describeBridgeCommandError({
        status: 500,
        code: 'INTERNAL_ERROR',
        title: 'boom',
        detail: 'SQLITE_ERROR: secret',
      }),
    ).toEqual({
      title: '이동하지 못했어요',
      detail: '잠시 뒤 다시 시도해 주세요. 사유는 저장되지 않았어요.',
      refresh: false,
    });
  });
});

describe('해지 브릿지 화면 불러오기 실패 안내 [T28][S16][S24]', () => {
  it('없는 기록이거나 남의 기록이면 찾을 수 없다고 안내하고 다시 시도 버튼은 없다', () => {
    expect(describeBridgeLoadError(error('NOT_FOUND', 404))).toEqual({
      title: '체험을 찾을 수 없어요',
      detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
      retry: false,
    });
  });

  it('이미 끝난 체험은 해지 안내를 열 수 없다고 이 화면의 문구로 안내한다 (BRIDGE_NOT_AVAILABLE)', () => {
    expect(describeBridgeLoadError(error('BRIDGE_NOT_AVAILABLE', 422))).toEqual({
      title: '지금은 해지 안내를 열 수 없어요',
      detail: '이미 끝난 체험은 해지 안내가 없어요. 내 체험에서 상태를 확인해 주세요.',
      retry: false,
    });
  });

  it('그 밖의 오류는 네트워크 확인을 안내하고 다시 시도할 수 있다', () => {
    expect(describeBridgeLoadError(error('INTERNAL_ERROR', 500))).toEqual({
      title: '해지 안내를 불러오지 못했어요',
      detail: '네트워크 상태를 확인한 뒤 다시 시도해 주세요.',
      retry: true,
    });
  });
});

describe('해지 브릿지 경로 오류 제보 실패 안내 [T28][S34]', () => {
  it('없는 기록이거나 남의 기록이면 찾을 수 없다고 안내한다', () => {
    expect(describeBrokenLinkReportError(error('NOT_FOUND', 404))).toEqual({
      title: '체험을 찾을 수 없어요',
      detail: '이미 삭제됐거나 주소가 바뀌었어요. 내 체험 목록에서 다시 확인해 주세요.',
    });
  });

  it('알 수 없는 오류는 서버 문구를 노출하지 않고 다시 시도하라고 안내한다', () => {
    expect(
      describeBrokenLinkReportError({
        status: 500,
        code: 'INTERNAL_ERROR',
        title: 'boom',
        detail: 'SQLITE_ERROR: secret',
      }),
    ).toEqual({
      title: '제보를 보내지 못했어요',
      detail: '잠시 뒤 다시 시도해 주세요.',
    });
  });
});
