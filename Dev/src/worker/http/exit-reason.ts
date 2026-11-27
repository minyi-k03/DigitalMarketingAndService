import { z } from 'zod';
import type { components } from '../../shared/api-types';

/** api/openapi.yaml의 ExitReason (SPEC §12). 사유를 받는 모든 라우트가 같은 목록으로 검증한다 */
export const EXIT_REASONS = [
  'PRICE_BURDEN',
  'LACK_OF_FEATURES',
  'COMPLEX_UX',
  'SHORT_TERM_GOAL_MET',
  'MOVED_TO_ALTERNATIVE',
] as const satisfies readonly components['schemas']['ExitReason'][];

// `satisfies`는 목록에 없는 값(누락)을 잡지 못한다. openapi에 ExitReason이 추가되면 아래 선언이 컴파일 오류가 된다
const _allExitReasonsListed: Exclude<
  components['schemas']['ExitReason'],
  (typeof EXIT_REASONS)[number]
> extends never
  ? true
  : never = true;
void _allExitReasonsListed;

export const exitReasonField = z.enum(EXIT_REASONS);
