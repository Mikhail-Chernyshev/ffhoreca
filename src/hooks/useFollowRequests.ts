import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFollowRequests, type FollowRequest } from '../lib/apiFollow';
import { queryKeys } from '../lib/queryKeys';

export function useFollowRequests(enabled: boolean): {
  requests: FollowRequest[];
  pendingCount: number;
  refresh: () => Promise<void>;
  removeRequest: (followerId: string) => void;
} {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: queryKeys.followRequests,
    queryFn: async () => {
      try {
        return await fetchFollowRequests();
      } catch {
        return [] as FollowRequest[];
      }
    },
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 60_000 : false,
    refetchOnWindowFocus: true,
  });

  const requests = enabled ? (q.data ?? []) : [];

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await qc.invalidateQueries({ queryKey: queryKeys.followRequests });
  }, [enabled, qc]);

  const removeRequest = useCallback((followerId: string) => {
    qc.setQueryData(queryKeys.followRequests, (prev: FollowRequest[] | undefined) =>
      (prev ?? []).filter((row) => row.follower.id !== followerId),
    );
  }, [qc]);

  return {
    requests,
    pendingCount: requests.length,
    refresh,
    removeRequest,
  };
}

