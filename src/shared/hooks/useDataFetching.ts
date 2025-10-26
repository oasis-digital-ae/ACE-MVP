import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/shared/lib/logger';

export interface UseDataFetchingOptions {
  enabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useDataFetching<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options: UseDataFetchingOptions = {}
) {
  const { enabled = true, onSuccess, onError } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await fetchFn();
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      logger.error('Data fetching error:', error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [...deps, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const refetch = useCallback(() => {
    return fetch();
  }, [fetch]);

  return { data, loading, error, refetch, setData };
}
