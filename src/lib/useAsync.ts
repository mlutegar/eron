import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refetch: () => void;
}

interface Options {
  /** Recarrega automaticamente a cada N ms (painel de monitoramento). */
  refreshMs?: number;
}

// Executa uma promise (ex.: chamada da api/client) e expoe estado + refetch.
// `deps` refaz a busca; util apos acoes como reprocessar.
export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: Options = {},
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const aliveRef = useRef(true);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    aliveRef.current = true;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (!aliveRef.current) return;
        setData(result);
        setLastUpdated(Date.now());
      })
      .catch((e: unknown) => {
        if (!aliveRef.current) return;
        setError(e instanceof Error ? e.message : "Falha ao carregar dados.");
      })
      .finally(() => {
        if (aliveRef.current) setLoading(false);
      });
    return () => {
      aliveRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  useEffect(() => {
    if (!options.refreshMs) return;
    const id = setInterval(refetch, options.refreshMs);
    return () => clearInterval(id);
  }, [options.refreshMs, refetch]);

  return { data, loading, error, lastUpdated, refetch };
}
