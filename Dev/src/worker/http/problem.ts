import type { components } from '../../shared/api-types';
import { DomainError, type DomainErrorCode } from '../platform/errors';

type Problem = components['schemas']['Problem'];

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

// HTTP 상태와 제목은 architecture §8 표를 따른다. 코드가 추가되면 컴파일이 실패한다.
const PROBLEMS = {
  VALIDATION_FAILED: { status: 400, title: 'Validation failed' },
  UNAUTHENTICATED: { status: 401, title: 'Authentication required' },
  FORBIDDEN: { status: 403, title: 'Forbidden' },
  NOT_FOUND: { status: 404, title: 'Not found' },
  INVALID_TRANSITION: { status: 409, title: 'Invalid state transition' },
  DUPLICATE_ACTIVE_RECORD: { status: 409, title: 'Active record already exists' },
  CONFLICT: { status: 409, title: 'Conflict' },
  EXIT_POLL_REQUIRED: { status: 422, title: 'Exit poll response required' },
  CATALOG_ITEM_NOT_PUBLISHED: { status: 422, title: 'Catalog item is not published' },
  TRIAL_ALREADY_ENDED: { status: 422, title: 'Trial already ended' },
  BRIDGE_NOT_AVAILABLE: { status: 422, title: 'Bridge is not available' },
  INTERNAL_ERROR: { status: 500, title: 'Internal server error' },
} satisfies Record<DomainErrorCode, { status: number; title: string }>;

export function toProblem(error: DomainError): Problem {
  const { status, title } = PROBLEMS[error.code];
  return {
    type: `https://subcut.app/problems/${error.code.toLowerCase().replaceAll('_', '-')}`,
    title,
    status,
    ...(error.message !== error.code && { detail: error.message }),
    code: error.code,
    ...error.extensions,
  };
}

/** 예상하지 못한 오류. 내부 정보(메시지·스택)는 담지 않는다 */
export const INTERNAL_ERROR_PROBLEM: Problem = toProblem(new DomainError('INTERNAL_ERROR'));
