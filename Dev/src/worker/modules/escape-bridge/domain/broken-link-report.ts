import type { components } from '../../../../shared/api-types';

export type BrokenLinkReport = components['schemas']['BrokenLinkReport'];
export type BrokenLinkTarget = BrokenLinkReport['target'];
export type BrokenLinkReportStatus = BrokenLinkReport['status'];
/** 운영자가 정할 수 있는 처리 결과 (`OPEN`으로 되돌리지는 않는다) */
export type ResolvedStatus = Exclude<BrokenLinkReportStatus, 'OPEN'>;

/** 동일 사용자·항목·대상의 제보는 이 시간 안에 1건만 접수한다 (SPEC §10 [확정]) */
export const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

/** 운영자 목록의 거름 조건 */
export interface BrokenLinkReportFilter {
  status?: BrokenLinkReportStatus;
  catalogItemId?: string;
}
