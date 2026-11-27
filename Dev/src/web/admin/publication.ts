import type { components } from '../../shared/api-types';

export type PublicationStatus = components['schemas']['PublicationStatus'];

const LABELS: Record<PublicationStatus, string> = {
  SUBMITTED: '검수 대기',
  PUBLISHED: '게시 중',
  REJECTED: '반려',
  UNPUBLISHED: '게시 중단',
};

export function publicationLabel(status: PublicationStatus): string {
  return LABELS[status];
}

export type PublicationTransition = {
  to: PublicationStatus;
  label: string;
  /** 사용자에게 영향이 큰 전이는 확인을 거친다 */
  confirm: boolean;
};

// 서버 `canChangePublicationStatus`(SPEC §2)와 같은 표. 서버가 최종 판단하며 어긋나면 409로 거절한다
const TRANSITIONS: Record<PublicationStatus, PublicationTransition[]> = {
  SUBMITTED: [
    { to: 'PUBLISHED', label: '게시', confirm: false },
    { to: 'REJECTED', label: '반려', confirm: true },
  ],
  PUBLISHED: [{ to: 'UNPUBLISHED', label: '게시 중단', confirm: true }],
  REJECTED: [],
  UNPUBLISHED: [],
};

/** 현재 게시 상태에서 누를 수 있는 전이 버튼 */
export function publicationTransitions(from: PublicationStatus): PublicationTransition[] {
  return TRANSITIONS[from];
}
