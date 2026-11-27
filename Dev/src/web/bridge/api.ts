import { useMutation, useQuery } from '@tanstack/react-query';
import type { components } from '../../shared/api-types';
import { apiFetch } from '../api/client';
import type { ExitReason } from '../trials/labels';
import type { BrokenLinkReportReceipt, BrokenLinkTarget } from './broken-link-report';

export type BridgeView = components['schemas']['BridgeView'];
export type StartCancelAttemptResult = components['schemas']['StartCancelAttemptResult'];

/**
 * 체험 기록 목록·상세와 같은 키 아래에 둔다. 사유를 고르면 기록 상태가 바뀌므로
 * `useRefreshTrials`가 목록·상세·브릿지를 한꺼번에 새로 불러온다
 */
export function useBridge(trialRecordId: string) {
  return useQuery({
    queryKey: ['trials', 'bridge', trialRecordId],
    queryFn: () => apiFetch<BridgeView>(`/api/trials/${encodeURIComponent(trialRecordId)}/bridge`),
  });
}

/** 사유 한 번 선택 = ExitPoll 응답 + CANCEL_ATTEMPTED 전이 + 직링크 반환 (SPEC §7) */
export function useSelectExitReason(trialRecordId: string) {
  return useMutation({
    mutationFn: (exitReason: ExitReason) =>
      apiFetch<StartCancelAttemptResult>(
        `/api/trials/${encodeURIComponent(trialRecordId)}/cancel-attempts`,
        { method: 'POST', body: { exitReason } },
      ),
  });
}

/** 경로 오류 제보 접수 (SPEC §10). 새 제보는 201, 24시간 내 중복은 200(duplicate=true) */
export function useReportBrokenLink(trialRecordId: string) {
  return useMutation({
    mutationFn: (target: BrokenLinkTarget) =>
      apiFetch<BrokenLinkReportReceipt>(
        `/api/trials/${encodeURIComponent(trialRecordId)}/broken-link-reports`,
        { method: 'POST', body: { target } },
      ),
  });
}
