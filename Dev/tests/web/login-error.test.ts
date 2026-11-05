import { describe, expect, it } from 'vitest';
import { loginErrorNotice } from '../../src/web/api/login-error';

describe('SPA 로그인 실패 안내 [T25][S16]', () => {
  it('동의 화면에서 취소해 돌아오면(loginError=access_denied) 취소했다는 안내를 준다', () => {
    const notice = loginErrorNotice('?loginError=access_denied');

    expect(notice?.title).toContain('취소');
    expect(notice?.detail).toBeTruthy();
  });

  it('그 밖의 오류(loginError=failed)는 취소와 다른, 다시 시도하라는 안내를 준다', () => {
    const failed = loginErrorNotice('?loginError=failed');
    const denied = loginErrorNotice('?loginError=access_denied');

    expect(failed?.title).toContain('로그인하지 못했어요');
    expect(failed?.title).not.toBe(denied?.title);
  });

  it.each(['', '?q=a', '?loginError=', '?loginError=<script>', '?loginError=ACCESS_DENIED'])(
    '쿼리가 없거나 알 수 없는 값(%s)이면 안내를 띄우지 않는다',
    (search) => {
      expect(loginErrorNotice(search)).toBeNull();
    },
  );
});
