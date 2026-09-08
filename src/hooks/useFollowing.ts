import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFollowing, type FollowingRow } from '../lib/apiFollow';
import { queryKeys } from '../lib/queryKeys';

export function useFollowing(enabled: boolean): {
  following: FollowingRow[];
  refresh: () => Promise<void>;
  removeFollowing: (ownerId: string) => void;
} {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: queryKeys.following,
    queryFn: async () => {
      try {
        return await fetchFollowing();
      } catch {
        return [] as FollowingRow[];
      }
    },
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await qc.invalidateQueries({ queryKey: queryKeys.following });
  }, [enabled, qc]);

  const removeFollowing = useCallback((ownerId: string) => {
    qc.setQueryData(queryKeys.following, (prev: FollowingRow[] | undefined) =>
      (prev ?? []).filter((row) => row.owner.id !== ownerId),
    );
  }, [qc]);

  return {
    following: enabled ? (q.data ?? []) : [],
    refresh,
    removeFollowing,
  };
}
