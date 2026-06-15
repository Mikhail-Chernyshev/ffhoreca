import { useCallback, useEffect, useState } from 'react';
import { fetchAuthAccount, type UserUsage } from '../lib/apiAuth';

export function useUserUsage(enabled: boolean): {
  usage: UserUsage | null;
  refresh: () => Promise<void>;
} {
  const [usage, setUsage] = useState<UserUsage | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUsage(null);
      return;
    }
    const data = await fetchAuthAccount();
    setUsage(data?.usage ?? null);
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { usage, refresh };
}
