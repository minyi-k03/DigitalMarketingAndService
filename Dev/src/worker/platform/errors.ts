import type { components } from '../../shared/api-types';

type Problem = components['schemas']['Problem'];

/** openapi `Problem.code`와 같은 값. 생성된 타입에서 가져오므로 계약이 바뀌면 컴파일이 실패한다 */
export type DomainErrorCode = Problem['code'];

/** problem+json에 그대로 실리는 부가 필드 (VALIDATION_FAILED의 errors 등) */
export type ProblemExtensions = Partial<
  Pick<Problem, 'errors' | 'existingTrialRecordId' | 'loginUrl'>
>;

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message?: string,
    readonly extensions: ProblemExtensions = {},
  ) {
    super(message ?? code);
    this.name = 'DomainError';
  }
}
