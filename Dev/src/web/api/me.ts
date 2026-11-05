import { useQuery } from '@tanstack/react-query';
import type { components } from '../../shared/api-types';
import { ApiRequestError, apiFetch } from './client';

export type Me = components['schemas']['Me'];

export const ME_QUERY_KEY = ['me'] as const;

/** 로그인한 계정. 세션이 없으면 `null`이며 로그인 화면으로 보내지 않는다 (공개 화면도 쓰므로) */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    staleTime: 60_000,
    queryFn: async (): Promise<Me | null> => {
      try {
        return await apiFetch<Me>('/api/me', { redirectOnUnauthorized: false });
      } catch (e) {
        if (e instanceof ApiRequestError && e.problem.code === 'UNAUTHENTICATED') return null;
        throw e;
      }
    },
  });
}
