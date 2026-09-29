// Agendador da integracao Conta Azul -> Questor Zen.
//
// Ciclo por janela:
//   1. reflete o estado do OAuth no /health
//   2. se ha token CA valido, busca cobrancas (contas a receber) e deduplica
//   3. [proximo passo] detalhe/status -> baixar PDF -> publicar no e-Doc do Zen
//      -> gravar log/quarentena  (upload no Zen ainda pendente, ver [[Pendencias]])
//   4. marca a janela no store
import { authStatus, contaAzul } from "./contaazul.js";
import { log } from "./logger.js";
import { DEMO_MODE } from "./mode.js";
import { sendAlert } from "./notify.js";
import { store } from "./store.js";

let timer: NodeJS.Timeout | null = null;

// Dedup em memoria por idCobranca — evita reprocessar a mesma cobranca.
// TODO: mover para PostgreSQL quando o dedup persistente existir ([[Arquitetura]]).
const processados = new Set<string>();

function idsDaResposta(cobrancas: unknown): string[] {
  const arr = Array.isArray(cobrancas)
    ? cobrancas
    : ((cobrancas as { itens?: unknown[]; content?: unknown[] })?.itens ?? (cobrancas as { content?: unknown[] })?.content ?? []);
  return (arr as Array<Record<string, unknown>>)
    .map((c) => String(c.id ?? c.idCobranca ?? c.uuid ?? ""))
    .filter(Boolean);
}

async function runCycle(now: Date): Promise<void> {
  const status = authStatus();
  store.setAuthState(status);

  if (!status.connected) {
    log.info("janela ignorada — Conta Azul nao conectada", { at: now.toISOString() });
    return;
  }
  try {
    const cobrancas = await contaAzul.buscarContasReceber();
    const ids = idsDaResposta(cobrancas);
    const novos = ids.filter((id) => !processados.has(id));
    novos.forEach((id) => processados.add(id));
    log.info("janela de sync executada", { total: ids.length, novos: novos.length });
    // TODO(proximo passo): para cada novo -> detalhe/status -> PDF -> upload e-Doc Zen -> store.

    // Modo automatico (opcional): publica os pendentes sem depender do botao "Ativar".
    if (DEMO_MODE && store.getSettings().autoRun && !store.isRunning()) {
      const r = store.runSync(now);
      log.info("auto-run concluido", { subiram: r.subiram, naoSubiram: r.naoSubiram });
      if (r.naoSubiram > 0) {
        await sendAlert("auto-run-parcial", `Auto-run: ${r.naoSubiram} nao publicado(s)`, `subiram=${r.subiram}`);
      }
    }
  } catch (err) {
    log.error("falha ao consultar Conta Azul", { err: String(err) });
    await sendAlert("ca-sync-fail", "Falha ao consultar a Conta Azul na janela de sync", String(err));
  }
}

export function startScheduler(intervalMin: number) {
  const ms = Math.max(1, intervalMin) * 60_000;
  const tick = () => {
    const now = new Date();
    store.markSyncRun(now);
    void runCycle(now);
  };
  tick(); // executa uma vez ao subir
  timer = setInterval(tick, ms);
  log.info("scheduler iniciado", { intervalMin });
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
