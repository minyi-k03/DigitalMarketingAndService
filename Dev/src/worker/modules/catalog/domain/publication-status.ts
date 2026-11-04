import type { components } from '../../../../shared/api-types';

export type PublicationStatus = components['schemas']['PublicationStatus'];

// SPEC §2: 검수 결과로 SUBMITTED → PUBLISHED | REJECTED, 게시 중단은 PUBLISHED → UNPUBLISHED.
// 그 밖의 전이(재게시 포함)는 명세에 없으므로 허용하지 않는다.
const ALLOWED: Record<PublicationStatus, readonly PublicationStatus[]> = {
  SUBMITTED: ['PUBLISHED', 'REJECTED'],
  PUBLISHED: ['UNPUBLISHED'],
  REJECTED: [],
  UNPUBLISHED: [],
};

export const canChangePublicationStatus = (from: PublicationStatus, to: PublicationStatus) =>
  ALLOWED[from].includes(to);
