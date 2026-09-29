// Camada de acesso a dados.
// HOJE: resolve a partir do mock com um pequeno atraso simulado.
// FUTURO: trocar o corpo de cada funcao por `fetch(BASE + rota)`
// mantendo as mesmas assinaturas/tipos. Nada mais no app muda.

import {
  boletos,
  clientMap,
  health,
  quarantine,
  syncLog,
} from "../data/mock";
import type {
  ClientMapping,
  Overview,
  QuarantineItem,
  SyncLogEntry,
  SystemHealth,
} from "../types/api";

// export const BASE = import.meta.env.VITE_API_URL ?? "/api";

const delay = <T,>(value: T, ms = 260): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// Mutavel em memoria para a acao de reprocessar (mock).
let quarantineState: QuarantineItem[] = [...quarantine];

export async function getOverview(): Promise<Overview> {
  const sincronizados = syncLog.filter((l) => l.status === "SINCRONIZADO");
  const valorMes = boletos
    .filter((b) => b.status === "SINCRONIZADO")
    .reduce((acc, b) => acc + b.valor, 0);
  return delay({
    counts: {
      hoje: sincronizados.filter((l) => l.timestamp.startsWith("2026-09-28")).length,
      semana: sincronizados.length,
      mes: sincronizados.length + 12,
      emQuarentena: quarantineState.length,
      valorMes: valorMes + 225_000,
    },
    health,
    ultimos: syncLog.slice(0, 5),
  });
}

export async function getSyncLogs(): Promise<SyncLogEntry[]> {
  return delay([...syncLog]);
}

export async function getQuarantine(): Promise<QuarantineItem[]> {
  return delay([...quarantineState]);
}

export async function reprocess(id: string): Promise<QuarantineItem[]> {
  quarantineState = quarantineState.filter((q) => q.id !== id);
  return delay([...quarantineState], 500);
}

export async function getClientMap(): Promise<ClientMapping[]> {
  return delay([...clientMap]);
}

export async function getHealth(): Promise<SystemHealth> {
  return delay(health);
}
