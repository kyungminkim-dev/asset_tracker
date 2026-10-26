import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/** 화면에 들어올 때마다(그리고 deps 가 바뀔 때) 데이터를 다시 불러온다 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await fn();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (id === seq.current) setError((err as Error).message);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
