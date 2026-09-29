// Camada de acesso a dados.
// Se VITE_API_URL estiver definido, faz fetch real ao backend integrador.
// Caso contrario, resolve a partir do mock (src/data/mock.ts) com atraso simulado.
// As assinaturas/tipos sao os mesmos nos dois modos — as telas nao mudam.

import { boletos, clientMap, health, quarantine, syncLog } from "../data/mock";
import type {
  ClientMapping,
  Overview,
  QuarantineItem,
  SyncLogEntry,
  SystemHealth,
} from "../types/api";

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
export const usingMock = BASE === "";

const delay = <T>(value: T, ms = 260): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`Erro ${res.status} ao acessar ${path}`);
  return res.json() as Promise<T>;
}

// Mutavel em memoria para a acao de reprocessar (modo mock).
let quarantineState: QuarantineItem[] = [...quarantine];

export async function getOverview(): Promise<Overview> {
  if (!usingMock) return http<Overview>("/overview");
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
  if (!usingMock) return http<SyncLogEntry[]>("/sync-logs");
  return delay([...syncLog]);
}

/** Tentativas de sincronizacao de um boleto especifico (para o detalhe). */
export async function getBoletoLogs(idCobranca: string): Promise<SyncLogEntry[]> {
  if (!usingMock) return http<SyncLogEntry[]>(`/boletos/${idCobranca}/logs`);
  return delay(syncLog.filter((l) => l.boleto.idCobranca === idCobranca));
}

export async function getQuarantine(): Promise<QuarantineItem[]> {
  if (!usingMock) return http<QuarantineItem[]>("/quarantine");
  return delay([...quarantineState]);
}

export async function reprocess(id: string): Promise<QuarantineItem[]> {
  if (!usingMock) return http<QuarantineItem[]>(`/quarantine/${id}/reprocess`, { method: "POST" });
  quarantineState = quarantineState.filter((q) => q.id !== id);
  return delay([...quarantineState], 500);
}

export async function getClientMap(): Promise<ClientMapping[]> {
  if (!usingMock) return http<ClientMapping[]>("/clients");
  return delay([...clientMap]);
}

export async function getHealth(): Promise<SystemHealth> {
  if (!usingMock) return http<SystemHealth>("/health");
  return delay(health);
}
