import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Result<T> {
  key: string;
  data: T | undefined;
  error: string | null;
}

/** 화면에 들어올 때마다(그리고 deps 가 바뀔 때) 데이터를 다시 불러온다 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  // 매 렌더마다 새로 만들어지는 fn 을 ref 로 들고 있어 run 은 항상 같은 함수로 유지된다
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  // 상태 변경은 모두 비동기 콜백 안에서만 한다. 늦게 도착한 이전 요청의 응답은 버린다
  const run = useCallback(async (key: string) => {
    const id = ++seq.current;
    try {
      const data = await fnRef.current();
      if (id === seq.current) setResult({ key, data, error: null });
    } catch (err) {
      if (id === seq.current) setResult((prev) => ({ key, data: prev?.data, error: (err as Error).message }));
    }
  }, []);

  const focused = useIsFocused();
  const key = JSON.stringify(deps);
  useEffect(() => {
    if (focused) run(key);
  }, [focused, key, run]);

  /** 당겨서 새로고침 등 사용자가 직접 다시 불러올 때 */
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      await run(key);
    } finally {
      setRefreshing(false);
    }
  }, [run, key]);

  return {
    data: result?.data,
    error: result?.error ?? null,
    loading: refreshing || result?.key !== key,
    reload,
  };
}
