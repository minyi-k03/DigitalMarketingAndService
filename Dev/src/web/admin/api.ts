import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '../../shared/api-types';
import { apiFetch } from '../api/client';
import type { UpdateBody } from './item-form';
import type { PublicationStatus } from './publication';
import type { Partner } from './partner-form';
import type { BrokenLinkReport, ReportStatusFilter } from './reports';

export type CatalogItem = components['schemas']['CatalogItem'];
type CatalogItemInput = components['schemas']['CatalogItemInput'];

const ADMIN_KEY = ['admin'] as const;
const ITEMS_KEY = [...ADMIN_KEY, 'items'] as const;
const REPORTS_KEY = [...ADMIN_KEY, 'reports'] as const;
const PARTNERS_KEY = [...ADMIN_KEY, 'partners'] as const;

/** 관리용 카탈로그 목록(모든 게시 상태). 상태별 거르기는 화면에서 한다 */
export function useAdminItems() {
  return useQuery({
    queryKey: ITEMS_KEY,
    queryFn: async () => {
      const body = await apiFetch<{ items: CatalogItem[] }>('/api/admin/catalog-items');
      return body.items;
    },
  });
}

/** 단건 조회 옵션. 화면 조회와 '최신으로 갈아 끼우기'가 같은 키·요청을 쓴다 */
const itemQuery = (catalogItemId: string) => ({
  queryKey: [...ITEMS_KEY, catalogItemId],
  queryFn: () =>
    apiFetch<CatalogItem>(`/api/admin/catalog-items/${encodeURIComponent(catalogItemId)}`),
});

export function useAdminItem(catalogItemId: string) {
  return useQuery(itemQuery(catalogItemId));
}

/** 다른 운영자가 먼저 바꿨을 때 서버의 최신 항목을 바로 받아 온다 */
export function useFetchLatestItem(catalogItemId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.fetchQuery({ ...itemQuery(catalogItemId), staleTime: 0 });
}

/** 운영자 화면과 사용자 카탈로그 둘 다 바뀌므로 함께 새로 불러온다 */
function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ITEMS_KEY });
    void queryClient.invalidateQueries({ queryKey: ['catalog'] });
  };
}

export function useCreateItem() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (body: CatalogItemInput) =>
      apiFetch<CatalogItem>('/api/admin/catalog-items', { method: 'POST', body }),
    onSuccess: refresh,
  });
}

export function useUpdateItem(catalogItemId: string) {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (body: UpdateBody) =>
      apiFetch<CatalogItem>(`/api/admin/catalog-items/${encodeURIComponent(catalogItemId)}`, {
        method: 'PATCH',
        body,
      }),
    onSuccess: refresh,
  });
}

export function useChangePublication(catalogItemId: string) {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (to: PublicationStatus) =>
      apiFetch<CatalogItem>(
        `/api/admin/catalog-items/${encodeURIComponent(catalogItemId)}/publication-status`,
        { method: 'POST', body: { to } },
      ),
    onSuccess: refresh,
  });
}

/** 서버는 `status`가 없으면 모든 상태를 돌려준다 */
export function useAdminReports(filter: ReportStatusFilter) {
  return useQuery({
    queryKey: [...REPORTS_KEY, filter],
    queryFn: async () => {
      const query = filter === 'ALL' ? '' : `?status=${filter}`;
      const body = await apiFetch<{ items: BrokenLinkReport[] }>(
        `/api/admin/broken-link-reports${query}`,
      );
      return body.items;
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reportId, status }: { reportId: string; status: 'FIXED' | 'REJECTED' }) =>
      apiFetch<BrokenLinkReport>(`/api/admin/broken-link-reports/${encodeURIComponent(reportId)}`, {
        method: 'PATCH',
        body: { status },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: REPORTS_KEY }),
  });
}

/** 파트너 목록. SponsoredTrial 폼에서만 필요하므로 `enabled`로 불필요한 요청을 막는다 */
export function usePartners({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: PARTNERS_KEY,
    enabled,
    queryFn: async () => {
      const body = await apiFetch<{ items: Partner[] }>('/api/admin/partners');
      return body.items;
    },
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: components['schemas']['PartnerInput']) =>
      apiFetch<Partner>('/api/admin/partners', { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PARTNERS_KEY }),
  });
}
