// fetch com timeout + retry com backoff exponencial.
// Retenta em erros de rede, 5xx e 429 (respeitando Retry-After). Nao retenta 4xx.
import { log } from "./logger.js";

export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
  retries?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15_000, retries = 3, ...init } = opts;
  let attempt = 0;
  // total de tentativas = retries + 1
  for (;;) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal });
      if ((res.status >= 500 || res.status === 429) && attempt < retries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff(attempt);
        log.warn("resposta retentavel", { url, status: res.status, attempt, wait });
        attempt++;
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      if (attempt >= retries) throw err;
      const wait = backoff(attempt);
      log.warn("erro de rede, retentando", { url, attempt, wait, err: String(err) });
      attempt++;
      await sleep(wait);
    } finally {
      clearTimeout(timer);
    }
  }
}

function backoff(attempt: number): number {
  // 500ms, 1s, 2s... com teto de 8s. Jitter deterministico por tentativa.
  const base = Math.min(8000, 500 * 2 ** attempt);
  return base + (attempt % 3) * 100;
}
