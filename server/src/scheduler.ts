// Agendador: a cada N minutos reflete o estado do OAuth no /health e roda um
// ciclo do motor (deteccao sempre; entrega so se as regras permitirem — ver sync.ts).
import { authStatus } from "./contaazul.js";
import { log } from "./logger.js";
import type { Store } from "./store.js";
import type { SyncEngine } from "./sync.js";

let timer: NodeJS.Timeout | null = null;
let emCiclo = false;

export function startScheduler(intervalMin: number, engine: SyncEngine, store: Store) {
  const ms = Math.max(1, intervalMin) * 60_000;
  const tick = async () => {
    const now = new Date();
    store.markSyncRun(now);
    const status = authStatus();
    store.setAuthState(status);
    if (!status.connected) {
      log.info("janela ignorada — Conta Azul nao conectada", { at: now.toISOString() });
      return;
    }
    if (emCiclo) {
      log.warn("janela pulada — ciclo anterior ainda em andamento");
      return;
    }
    emCiclo = true;
    try {
      await engine.ciclo();
    } finally {
      emCiclo = false;
    }
  };
  void tick(); // executa uma vez ao subir
  timer = setInterval(() => void tick(), ms);
  log.info("scheduler iniciado", { intervalMin });
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
