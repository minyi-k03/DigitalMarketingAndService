import { readApiResponse, type ApiError } from './response';

export class ApiRequestError extends Error {
  constructor(readonly problem: ApiError) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiRequestError';
  }
}

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** 401이면 카카오 로그인으로 이동한다. 로그인 여부만 확인하는 호출은 false로 두고 오류를 받는다 */
  redirectOnUnauthorized?: boolean;
};

/** 같은 출처의 `/api`·`/auth`를 호출한다. 실패는 ApiRequestError로 던진다 (architecture §8) */
export async function apiFetch<T>(
  path: string,
  { method = 'GET', body, redirectOnUnauthorized = true }: ApiFetchOptions = {},
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await readApiResponse<T>(res, window.location.pathname + window.location.search);

  if (result.ok) return result.data;
  if (result.loginRedirect && redirectOnUnauthorized) {
    window.location.assign(result.loginRedirect);
    // 페이지가 넘어가는 동안 호출자가 오류 화면을 그리지 않도록 끝나지 않는 약속으로 둔다
    return new Promise<never>(() => {});
  }
  throw new ApiRequestError(result.error);
}
