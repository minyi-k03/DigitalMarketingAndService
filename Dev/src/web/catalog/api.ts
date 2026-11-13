import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../shared/api-types';
import { apiFetch } from '../api/client';

export type CatalogItemPublicView = components['schemas']['CatalogItemPublicView'];
export type TrialRecordView = components['schemas']['TrialRecordView'];

const CATALOG_KEY = ['catalog'] as const;

/** 카탈로그 전체 목록. 분야·검색은 화면에서 거르므로 서버 필터(category·q)는 쓰지 않는다 */
export function useCatalogList() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: async () => {
      const body = await apiFetch<{ items: CatalogItemPublicView[] }>('/api/catalog', {
        redirectOnUnauthorized: false,
      });
      return body.items;
    },
  });
}

export function useCatalogItem(catalogItemId: string) {
  return useQuery({
    queryKey: [...CATALOG_KEY, catalogItemId],
    queryFn: () =>
      apiFetch<CatalogItemPublicView>(`/api/catalog/${encodeURIComponent(catalogItemId)}`, {
        redirectOnUnauthorized: false,
      }),
  });
}

type CreateTrialInput = { catalogItemId: string; startDate?: string };

/** 1초 간편 등록. `startDate`를 생략하면 서버가 오늘(KST)과 기본 체험 일수를 채운다 (S8) */
export function useCreateTrial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTrialInput) =>
      apiFetch<TrialRecordView>('/api/trials', {
        method: 'POST',
        body: { ...input, source: 'MANUAL_CATALOG_SELECT' },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trials'] }),
  });
}
