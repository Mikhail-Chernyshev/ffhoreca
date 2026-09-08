import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchFollowers, type FollowRequest } from '../lib/apiFollow';
import { queryKeys } from '../lib/queryKeys';

export function useFollowers(enabled: boolean): {
  followers: FollowRequest[];
  refresh: () => Promise<void>;
  addFollower: (row: FollowRequest) => void;
  removeFollower: (followerId: string) => void;
} {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: queryKeys.followers,
    queryFn: async () => {
      try {
        return await fetchFollowers();
      } catch {
        return [] as FollowRequest[];
      }
    },
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const refresh = useCallback(async () => {
    if (!enabled) return;
    await qc.invalidateQueries({ queryKey: queryKeys.followers });
  }, [enabled, qc]);

  const addFollower = useCallback((row: FollowRequest) => {
    qc.setQueryData(queryKeys.followers, (prev: FollowRequest[] | undefined) => {
      const list = prev ?? [];
      if (list.some((item) => item.follower.id === row.follower.id)) return list;
      return [row, ...list];
    });
  }, [qc]);

  const removeFollower = useCallback((followerId: string) => {
    qc.setQueryData(queryKeys.followers, (prev: FollowRequest[] | undefined) =>
      (prev ?? []).filter((row) => row.follower.id !== followerId),
    );
  }, [qc]);

  return {
    followers: enabled ? (q.data ?? []) : [],
    refresh,
    addFollower,
    removeFollower,
  };
}
