import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAuthAccount, type UserUsage } from '../lib/apiAuth';
import { queryKeys } from '../lib/queryKeys';

export function useUserUsage(enabled: boolean): {
  usage: UserUsage | null;
  refresh: () => Promise<void>;
} {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: queryKeys.authUsage,
    queryFn: async () => {
      const data = await fetchAuthAccount();
      return data?.usage ?? null;
    },
    enabled,
  });

  return {
    usage: enabled ? (q.data ?? null) : null,
    refresh: async () => {
      if (!enabled) return;
      await qc.invalidateQueries({ queryKey: queryKeys.authUsage });
    },
  };
}
