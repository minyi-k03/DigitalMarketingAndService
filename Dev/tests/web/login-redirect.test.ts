import { describe, expect, it } from 'vitest';
import { buildLoginRedirect } from '../../src/web/api/login-redirect';

describe('SPA API 클라이언트 로그인 이동 [T25][S16]', () => {
  it('서버가 준 loginUrl의 returnTo를 API 경로 대신 현재 화면 경로로 바꾼다', () => {
    const url = buildLoginRedirect('/auth/kakao/login?returnTo=%2Fapi%2Fme', '/catalog?q=a');

    expect(url).toBe('/auth/kakao/login?returnTo=%2Fcatalog%3Fq%3Da');
  });

  it('loginUrl이 없는 401이어도 기본 카카오 로그인 경로로 현재 화면 returnTo를 담아 보낸다', () => {
    const url = buildLoginRedirect(undefined, '/trials/abc');

    expect(url).toBe('/auth/kakao/login?returnTo=%2Ftrials%2Fabc');
  });

  it('로그인 실패 안내용 loginError 쿼리는 returnTo에 싣지 않아 재로그인 후 오류 주소로 돌아오지 않는다', () => {
    const url = buildLoginRedirect(undefined, '/?loginError=access_denied');

    expect(url).toBe('/auth/kakao/login?returnTo=%2F');
  });

  it('loginError 외의 쿼리는 그대로 returnTo에 남긴다', () => {
    const url = buildLoginRedirect(undefined, '/catalog?q=a&loginError=failed');

    expect(url).toBe('/auth/kakao/login?returnTo=%2Fcatalog%3Fq%3Da');
  });

  it.each(['//evil.example/path', 'https://evil.example/path', 'catalog'])(
    '내부 경로가 아닌 현재 경로(%s)는 홈(/)으로 대체해 서버가 거부할 값을 보내지 않는다',
    (currentPath) => {
      const url = buildLoginRedirect('/auth/kakao/login?returnTo=%2Fapi%2Fme', currentPath);

      expect(url).toBe('/auth/kakao/login?returnTo=%2F');
    },
  );
});
