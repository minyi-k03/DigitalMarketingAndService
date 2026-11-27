import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { components, paths } from '../../shared/api-types';
import { apiFetch } from '../api/client';
import type { TrialRecordView } from '../catalog/api';
import { commandRequest } from './commands';
import type { UpdateBody } from './edit-request';
import type { ExitReason } from './labels';
import type { TrialsTab } from './tab';

export type { TrialRecordView };
export type TrialAction = components['schemas']['TrialAction'];

export type TrialsResponse =
  paths['/api/trials']['get']['responses']['200']['content']['application/json'];

/** 목록·상세·요약이 모두 이 키 아래에 있어 명령이 끝나면 한 번에 새로 불러온다 */
const TRIALS_KEY = ['trials'] as const;

export function useTrials(tab: TrialsTab) {
  return useQuery({
    queryKey: [...TRIALS_KEY, 'list', tab],
    queryFn: () => apiFetch<TrialsResponse>(`/api/trials?tab=${tab}`),
  });
}

export function useTrial(trialRecordId: string) {
  return useQuery({
    queryKey: [...TRIALS_KEY, 'detail', trialRecordId],
    queryFn: () => apiFetch<TrialRecordView>(`/api/trials/${encodeURIComponent(trialRecordId)}`),
  });
}

export type RefundTemplate = components['schemas']['RefundTemplate'];

/** 환불 요청 템플릿(국·영문). 결제 확인 정정으로 상태가 바뀔 수 있어 같은 키 아래에 둔다 */
export function useRefundTemplate(trialRecordId: string) {
  return useQuery({
    queryKey: [...TRIALS_KEY, 'refund-template', trialRecordId],
    queryFn: () =>
      apiFetch<RefundTemplate>(`/api/trials/${encodeURIComponent(trialRecordId)}/refund-template`),
  });
}

type CommandInput = { action: TrialAction; exitReason?: ExitReason };

/**
 * 서버의 최신 상태를 다시 불러온다. Promise를 돌려주지 않는다: 명령 옵션의 `onSuccess`·`onSettled`가
 * Promise를 반환하면 TanStack Query가 그 갱신이 끝난 뒤에야 호출부 `onError`를 실행하고, 그 사이 카드가
 * 목록에서 빠져 시트와 안내가 함께 사라진다.
 */
export function useRefreshTrials() {
  const queryClient = useQueryClient();
  // 화면의 이벤트 리스너 등록 effect가 매 렌더마다 다시 걸리지 않도록 같은 함수를 돌려준다
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: TRIALS_KEY });
  }, [queryClient]);
}

/**
 * 유지·등록 취소·해지 확정·결제 확인 정정. 성공하면 목록·상세를 새로 불러온다.
 * 실패는 화면이 안내를 보여 준 뒤 시트를 닫을 때 새로 불러온다(`CommandFailure.stale`).
 */
export function useTrialCommand(trialRecordId: string) {
  const refresh = useRefreshTrials();
  return useMutation({
    mutationFn: ({ action, exitReason }: CommandInput) => {
      const request = commandRequest(trialRecordId, action, exitReason);
      if (!request) throw new Error(`요청이 없는 행동입니다: ${action}`);
      return apiFetch<TrialRecordView>(request.path, { method: 'POST', body: request.body });
    },
    onSuccess: refresh,
  });
}

/** 시작일·체험 일수 수정 (스토리 42). 서버가 날짜를 다시 계산하고 알림을 다시 잡는다 */
export function useUpdateTrial(trialRecordId: string) {
  const refresh = useRefreshTrials();
  return useMutation({
    mutationFn: (body: UpdateBody) =>
      apiFetch<TrialRecordView>(`/api/trials/${encodeURIComponent(trialRecordId)}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: refresh,
  });
}
