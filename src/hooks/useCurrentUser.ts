import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchCurrentUser,
  logout as doLogout,
  type AuthUser,
} from '../lib/apiAuth';
import { queryKeys } from '../lib/queryKeys';

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => Promise<void>;
  logout: () => void;
}

export function useCurrentUser(): AuthState {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: queryKeys.authMe,
    queryFn: fetchCurrentUser,
  });

  const logoutMutation = useMutation({
    mutationFn: doLogout,
    onSuccess: () => {
      qc.setQueryData(queryKeys.authMe, null);
      void qc.invalidateQueries({ queryKey: ['auth'] });
      void qc.invalidateQueries({ queryKey: queryKeys.favorites });
    },
  });

  return {
    user: q.data ?? null,
    loading: q.isPending,
    refetch: async () => {
      await q.refetch();
    },
    logout: () => {
      logoutMutation.mutate();
    },
  };
}
