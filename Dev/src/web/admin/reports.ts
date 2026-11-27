import type { components } from '../../shared/api-types';

export type BrokenLinkReport = components['schemas']['BrokenLinkReport'];
type ReportStatus = BrokenLinkReport['status'];
type ReportTarget = BrokenLinkReport['target'];

export type ReportStatusFilter = ReportStatus | 'ALL';

const TARGETS: Record<ReportTarget, string> = {
  ESCAPE_LINK: '해지 링크',
  ESCAPE_GUIDE: '해지 가이드',
};

const STATUSES: Record<ReportStatus, string> = {
  OPEN: '처리 대기',
  FIXED: '수정 완료',
  REJECTED: '반려',
};

export const reportTargetLabel = (target: ReportTarget) => TARGETS[target];
export const reportStatusLabel = (status: ReportStatus) => STATUSES[status];

export type ReportAction = { status: 'FIXED' | 'REJECTED'; label: string };

/** 처리할 수 있는 건 처리 대기 제보뿐이다. 서버도 OPEN으로 되돌리는 요청을 거부한다 */
export function reportActions(status: ReportStatus): ReportAction[] {
  return status === 'OPEN'
    ? [
        { status: 'FIXED', label: STATUSES.FIXED },
        { status: 'REJECTED', label: STATUSES.REJECTED },
      ]
    : [];
}

/** 화면의 필터 탭 순서. 주소 해석도 이 목록을 쓴다 */
export const REPORT_FILTERS: readonly ReportStatusFilter[] = ['OPEN', 'FIXED', 'REJECTED', 'ALL'];

export const reportFilterLabel = (filter: ReportStatusFilter) =>
  filter === 'ALL' ? '전체' : STATUSES[filter];

/** 주소의 `?status=` 값. 없거나 올바르지 않으면 처리할 일이 있는 `OPEN`을 보여 준다 */
export function parseReportStatusFilter(search: string): ReportStatusFilter {
  const value = new URLSearchParams(search).get('status');
  return REPORT_FILTERS.find((f) => f === value) ?? 'OPEN';
}
