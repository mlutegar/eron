// Camada de acesso a dados.
// Se VITE_API_URL estiver definido, faz fetch real ao backend integrador.
// Caso contrario, resolve a partir do mock (src/data/mock.ts) com atraso simulado.
// As assinaturas/tipos sao os mesmos nos dois modos — as telas nao mudam.
//
// No modo HTTP toda resposta e validada com Zod (src/types/api.ts) antes de
// chegar as telas: um payload divergente do contrato falha cedo e de forma
// legivel, em vez de quebrar a UI silenciosamente.

import type { ZodType } from "zod";
import { boletos, clientMap, health, quarantine, syncLog } from "../data/mock";
import {
  BoletoListSchema,
  ClientMappingListSchema,
  LastRunSchema,
  OverviewSchema,
  QuarantineListSchema,
  RunResultSchema,
  SettingsSchema,
  SyncLogListSchema,
  SystemHealthSchema,
  type Boleto,
  type ClientMapping,
  type LastRun,
  type Overview,
  type QuarantineItem,
  type RunItem,
  type RunResult,
  type Settings,
  type SyncLogEntry,
  type SystemHealth,
} from "../types/api";

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
const TOKEN = import.meta.env.VITE_API_TOKEN ?? "";
export const usingMock = BASE === "";
// Sem VITE_API_URL o painel roda com dados ficticios e o botao Ativar apenas simula.
// Com a API real, quem decide se algo e publicado e a chave geral (settings.envioHabilitado).
export const publishingSimulated = usingMock;

const delay = <T>(value: T, ms = 260): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/** Token enviado ao backend: API_TOKEN fixo (se configurado) ou a sessao do login. */
function authHeader(): Record<string, string> {
  const token = TOKEN || (localStorage.getItem("iazan.session") ? (JSON.parse(localStorage.getItem("iazan.session")!) as { token?: string }).token : undefined);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function http<T>(path: string, schema: ZodType<T>, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    ...init,
  });
  if (res.status === 401) {
    // Sessao expirada/invalida: o AuthProvider escuta este evento e volta ao login.
    window.dispatchEvent(new Event("iazan:unauthorized"));
  }
  if (!res.ok) {
    // O backend responde { error: CODIGO, mensagem } — repassa os dois para a UI orientar o operador.
    let detalhe = "";
    try {
      const body = (await res.json()) as { error?: string; mensagem?: string };
      detalhe = [body.error, body.mensagem].filter(Boolean).join(": ");
    } catch {
      /* corpo nao-JSON */
    }
    throw new Error(`Erro ${res.status} ao acessar ${path}${detalhe ? ` — ${detalhe}` : ""}`);
  }
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Resposta invalida de ${path}: ${parsed.error.issues[0]?.message ?? "formato inesperado"}`);
  }
  return parsed.data;
}

// Mutavel em memoria para a acao de reprocessar (modo mock).
let quarantineState: QuarantineItem[] = [...quarantine];

/** Dia de referencia = data mais recente presente no log (mantem o mock coerente sem datas fixas). */
function refDate(): Date {
  const latest = syncLog.reduce((max, l) => {
    const t = new Date(l.timestamp).getTime();
    return t > max ? t : max;
  }, 0);
  return new Date(latest || Date.now());
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const withinDays = (a: Date, b: Date, days: number) =>
  Math.abs(a.getTime() - b.getTime()) <= days * 24 * 60 * 60 * 1000;

export async function getOverview(): Promise<Overview> {
  if (!usingMock) return http<Overview>("/overview", OverviewSchema);
  const ref = refDate();
  const sincronizados = syncLog.filter((l) => l.status === "SINCRONIZADO");
  const valorMes = boletos
    .filter((b) => b.status === "SINCRONIZADO" && sameMonth(new Date(b.emitidoEm), ref))
    .reduce((acc, b) => acc + b.valor, 0);
  return delay({
    counts: {
      hoje: sincronizados.filter((l) => sameDay(new Date(l.timestamp), ref)).length,
      semana: sincronizados.filter((l) => withinDays(new Date(l.timestamp), ref, 7)).length,
      mes: sincronizados.filter((l) => sameMonth(new Date(l.timestamp), ref)).length,
      emQuarentena: quarantineState.length,
      valorMes,
    },
    health,
    ultimos: syncLog.slice(0, 5),
  });
}

export async function getSyncLogs(): Promise<SyncLogEntry[]> {
  if (!usingMock) return http<SyncLogEntry[]>("/sync-logs", SyncLogListSchema);
  return delay([...syncLog]);
}

/** Tentativas de sincronizacao de um boleto especifico (para o detalhe). */
export async function getBoletoLogs(idCobranca: string): Promise<SyncLogEntry[]> {
  if (!usingMock) return http<SyncLogEntry[]>(`/boletos/${idCobranca}/logs`, SyncLogListSchema);
  return delay(syncLog.filter((l) => l.boleto.idCobranca === idCobranca));
}

export async function getQuarantine(): Promise<QuarantineItem[]> {
  if (!usingMock) return http<QuarantineItem[]>("/quarantine", QuarantineListSchema);
  return delay([...quarantineState]);
}

export async function reprocess(id: string): Promise<QuarantineItem[]> {
  if (!usingMock)
    return http<QuarantineItem[]>(`/quarantine/${id}/reprocess`, QuarantineListSchema, { method: "POST" });
  quarantineState = quarantineState.filter((q) => q.id !== id);
  return delay([...quarantineState], 500);
}

/** Boletos ainda nao publicados no Zen (aguardando o robo processar). */
export async function getPending(): Promise<Boleto[]> {
  if (!usingMock) return http<Boleto[]>("/pending", BoletoListSchema);
  return delay(boletos.filter((b) => b.status !== "SINCRONIZADO"));
}

const LAST_RUN_KEY = "iazan.lastRun";
const SETTINGS_KEY = "iazan.settings";
const mockPublished = new Set<string>(); // idempotencia no mock (idCobranca ja publicados)

function saveLastRun(r: RunResult) {
  try {
    localStorage.setItem(LAST_RUN_KEY, JSON.stringify(r));
  } catch {
    /* ambiente sem localStorage (SSR/testes) — ignora */
  }
}

/**
 * Liga o robo: varre os boletos pendentes e tenta publicar cada um no e-Doc do Zen,
 * batendo pelo nome/CNPJ do cliente. Retorna o log da execucao (subiu / nao subiu).
 * Idempotente: nao republica boletos ja enviados.
 */
export async function runSync(): Promise<RunResult> {
  if (!usingMock) {
    const r = await http<RunResult>("/run", RunResultSchema, { method: "POST" });
    return r;
  }

  const pendentes = boletos.filter(
    (b) => b.status !== "SINCRONIZADO" && !mockPublished.has(b.idCobranca),
  );
  const motivoQuarentena = new Map(quarantineState.map((q) => [q.boleto.idCobranca, q.motivo]));

  const itens: RunItem[] = pendentes.map((b) => {
    // Sobe quando ha empresa mapeada no Zen; caso contrario, reporta o motivo.
    const ok = b.empresaZen !== null;
    if (ok) {
      mockPublished.add(b.idCobranca);
      quarantineState = quarantineState.filter((q) => q.boleto.idCobranca !== b.idCobranca);
    }
    const mensagem = ok
      ? `Boleto publicado no Zen para ${b.empresaZen}.`
      : (motivoQuarentena.get(b.idCobranca) ?? `CNPJ ${b.cnpj} nao mapeado no Zen.`);
    return { boleto: b, ok, mensagem };
  });

  const subiram = itens.filter((i) => i.ok);
  const result: RunResult = {
    executadoEm: refDate().toISOString(),
    total: itens.length,
    subiram: subiram.length,
    naoSubiram: itens.length - subiram.length,
    valorPublicado: subiram.reduce((acc, i) => acc + i.boleto.valor, 0),
    itens,
  };
  saveLastRun(result);
  return delay(result, 1200);
}

/** Ultima execucao (para exibir ao abrir a tela sem precisar rodar de novo). */
export async function getLastRun(): Promise<LastRun> {
  if (!usingMock) return http<LastRun>("/last-run", LastRunSchema);
  try {
    const raw = localStorage.getItem(LAST_RUN_KEY);
    if (!raw) return null;
    return LastRunSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function getSettings(): Promise<Settings> {
  if (!usingMock) return http<Settings>("/settings", SettingsSchema);
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return SettingsSchema.parse(JSON.parse(raw));
  } catch {
    /* ignora */
  }
  return { autoRun: false, envioHabilitado: false, dataCorte: null, limitePorRodada: 20, destinatarios: [] };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  if (!usingMock)
    return http<Settings>("/settings", SettingsSchema, {
      method: "POST",
      body: JSON.stringify(patch),
    });
  const current = await getSettings();
  const next = { ...current, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* ignora */
  }
  return next;
}

export async function getClientMap(): Promise<ClientMapping[]> {
  if (!usingMock) return http<ClientMapping[]>("/clients", ClientMappingListSchema);
  return delay([...clientMap]);
}

export async function getHealth(): Promise<SystemHealth> {
  if (!usingMock) return http<SystemHealth>("/health", SystemHealthSchema);
  return delay(health);
}
