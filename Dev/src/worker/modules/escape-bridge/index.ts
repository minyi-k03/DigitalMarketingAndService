import {
  listBrokenLinkReports,
  resolveBrokenLinkReport,
  submitBrokenLinkReport,
  type SubmitBrokenLinkReportCommand,
} from './application/broken-link-report';
import { getBridgeView, type BridgeViewQuery } from './application/get-bridge-view';
import { getRefundTemplate, type RefundTemplateQuery } from './application/get-refund-template';
import { selectExitReason, type SelectExitReasonCommand } from './application/select-exit-reason';
import type { EscapeBridgeDeps } from './deps';
import type { BrokenLinkReportFilter, ResolvedStatus } from './domain/broken-link-report';

export type { EscapeBridgeDeps } from './deps';
export type { BridgeView, BridgeViewQuery } from './application/get-bridge-view';
export type { RefundTemplate, RefundTemplateQuery } from './application/get-refund-template';
export type {
  BrokenLinkReportReceipt,
  SubmitBrokenLinkReportCommand,
} from './application/broken-link-report';
export type {
  BrokenLinkReport,
  BrokenLinkReportFilter,
  BrokenLinkReportStatus,
  BrokenLinkTarget,
  ResolvedStatus,
} from './domain/broken-link-report';
export type {
  SelectExitReasonCommand,
  SelectExitReasonResult,
} from './application/select-exit-reason';

/** EscapeBridge & Recovery 모듈의 공개 인터페이스. 다른 모듈은 이 객체로만 호출한다 */
export function createEscapeBridgeService(deps: EscapeBridgeDeps) {
  return {
    getBridgeView: (query: BridgeViewQuery) => getBridgeView(deps, query),
    selectExitReason: (cmd: SelectExitReasonCommand) => selectExitReason(deps, cmd),
    getRefundTemplate: (query: RefundTemplateQuery) => getRefundTemplate(deps, query),
    submitBrokenLinkReport: (cmd: SubmitBrokenLinkReportCommand) =>
      submitBrokenLinkReport(deps, cmd),
    listBrokenLinkReports: (filter: BrokenLinkReportFilter) => listBrokenLinkReports(deps, filter),
    resolveBrokenLinkReport: (id: string, status: ResolvedStatus) =>
      resolveBrokenLinkReport(deps, id, status),
  };
}

export type EscapeBridgeService = ReturnType<typeof createEscapeBridgeService>;
