import type { components } from '../../shared/api-types';
import { buildLoginRedirect } from './login-redirect';

type Problem = components['schemas']['Problem'];

export type ApiError = Pick<
  Problem,
  'status' | 'code' | 'title' | 'detail' | 'errors' | 'existingTrialRecordId'
>;

export type ApiResult<T> =
  | { ok: true; data: T }
  // loginRedirect가 있으면 세션이 없는 것이므로 호출자가 이 주소로 이동한다
  | { ok: false; error: ApiError; loginRedirect?: string };

/** fetch 응답을 성공 데이터 또는 problem+json 오류로 해석한다 (architecture §8) */
export async function readApiResponse<T>(
  res: Response,
  currentPath: string,
): Promise<ApiResult<T>> {
  if (res.status === 204) return { ok: true, data: undefined as T };
  if (res.ok) return { ok: true, data: (await res.json()) as T };

  const problem = (await res.json().catch(() => undefined)) as Problem | undefined;
  if (!problem?.code) {
    // 프록시·Cloudflare가 돌려준 HTML 등 계약 밖 응답
    return {
      ok: false,
      error: { status: res.status, code: 'INTERNAL_ERROR', title: res.statusText },
    };
  }
  const error: ApiError = {
    status: problem.status,
    code: problem.code,
    title: problem.title,
    detail: problem.detail,
    errors: problem.errors,
    existingTrialRecordId: problem.existingTrialRecordId,
  };
  if (problem.code === 'UNAUTHENTICATED') {
    return { ok: false, error, loginRedirect: buildLoginRedirect(problem.loginUrl, currentPath) };
  }
  return { ok: false, error };
}
