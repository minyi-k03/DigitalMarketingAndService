import type { components } from '../../../../shared/api-types';
import { toUtcInstant } from '../../../../shared/kst-date';
import { DomainError } from '../../../platform/errors';
import { newId } from '../../../platform/id';
import type { EscapeBridgeDeps } from '../deps';
import {
  DEDUPE_WINDOW_MS,
  type BrokenLinkReport,
  type BrokenLinkReportFilter,
  type BrokenLinkTarget,
  type ResolvedStatus,
} from '../domain/broken-link-report';
import {
  findRecentDuplicate,
  insertUnlessDuplicate,
  listReports,
  resolveReport,
} from '../infra/broken-link-report-repo';

export type BrokenLinkReportReceipt = components['schemas']['BrokenLinkReportReceipt'];

export interface SubmitBrokenLinkReportCommand {
  userId: string;
  trialRecordId: string;
  target: BrokenLinkTarget;
}

/**
 * 경로 오류 제보 접수 (SPEC §10, 스토리 34). 같은 사용자·항목·대상의 제보가 최근 24시간 안에 있으면
 * 새로 만들지 않고 기존 제보를 돌려준다(`duplicate: true`). 남의 기록은 TT가 `NOT_FOUND`로 거절한다.
 * 제보 대상은 기록 상태와 무관하게 본인 기록이면 접수한다(상태별 제한은 SPEC에 없다).
 */
export async function submitBrokenLinkReport(
  deps: EscapeBridgeDeps,
  cmd: SubmitBrokenLinkReportCommand,
): Promise<BrokenLinkReportReceipt> {
  const { catalogItemId } = await deps.trialTracking.getBridgeState({
    userId: cmd.userId,
    trialRecordId: cmd.trialRecordId,
  });
  const now = deps.clock.now();
  const createdAt = toUtcInstant(now);
  const cutoff = toUtcInstant(new Date(now.getTime() - DEDUPE_WINDOW_MS));
  const key = { userId: cmd.userId, catalogItemId, target: cmd.target };

  const id = newId();
  const inserted = await insertUnlessDuplicate(
    deps.db,
    { id, ...key, trialRecordId: cmd.trialRecordId, createdAt },
    cutoff,
  );
  if (inserted) return { id, duplicate: false };

  const existing = await findRecentDuplicate(deps.db, key, cutoff);
  // 삽입이 막힌 직후라 항상 있다. 없다면 불변식이 깨진 것이므로 오류로 알린다
  if (!existing) throw new Error('중복 제보를 찾을 수 없습니다');
  return { id: existing.id, duplicate: true };
}

/** 운영자용 제보 목록(최신순). 상태·항목으로 거른다 (스토리 40) */
export async function listBrokenLinkReports(
  deps: EscapeBridgeDeps,
  filter: BrokenLinkReportFilter,
): Promise<{ items: BrokenLinkReport[] }> {
  return { items: await listReports(deps.db, filter) };
}

/** 제보 처리 결과를 FIXED·REJECTED로 바꾼다. 없는 제보는 NOT_FOUND다. 권한은 HTTP 계층의 `requireRole`이 검사한다 */
export async function resolveBrokenLinkReport(
  deps: EscapeBridgeDeps,
  id: string,
  status: ResolvedStatus,
): Promise<BrokenLinkReport> {
  const updated = await resolveReport(deps.db, id, status, toUtcInstant(deps.clock.now()));
  if (!updated) throw new DomainError('NOT_FOUND');
  return updated;
}
