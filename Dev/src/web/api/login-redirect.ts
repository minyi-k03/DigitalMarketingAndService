const HOME = '/';
const DEFAULT_LOGIN_PATH = '/auth/kakao/login';

// 서버(isInternalPath)와 같은 기준: `/`로 시작하고 `//`로 시작하지 않는 경로만 내부 경로다.
function isInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/**
 * 401 응답의 loginUrl은 요청한 API 경로(`/api/me`)를 returnTo로 담고 있다.
 * 로그인 후에는 사용자가 보던 화면으로 돌아와야 하므로 returnTo만 현재 화면 경로로 바꾼다.
 */
export function buildLoginRedirect(loginUrl: string | undefined, currentPath: string): string {
  const url = new URL(loginUrl ?? DEFAULT_LOGIN_PATH, 'http://localhost');
  url.searchParams.set('returnTo', isInternalPath(currentPath) ? currentPath : HOME);
  return url.pathname + url.search;
}
