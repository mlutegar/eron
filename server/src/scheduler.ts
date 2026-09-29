// Agendador: a cada N minutos reflete o estado do OAuth no /health, roda um
// ciclo do motor (deteccao sempre; entrega so se as regras permitirem — ver
// sync.ts) e, a partir das 18h (Brasilia), envia o resumo diario uma vez.
import { authStatus } from "./contaazul.js";
import type { Db } from "./db.js";
import type { EmailSender } from "./email.js";
import { log } from "./logger.js";
import { deveEnviarResumo, montarResumo, textoDoResumo } from "./resumo.js";
import type { Store } from "./store.js";
import type { SyncEngine } from "./sync.js";

let timer: NodeJS.Timeout | null = null;
let emCiclo = false;

const CHAVE_RESUMO = "resumoEnviadoEm";

export async function enviarResumoSeForHora(db: Db, engine: SyncEngine, email: EmailSender, agora = new Date()): Promise<boolean> {
  if (!email.enabled) return false;
  const ultimo = db.getConfig<string | null>(CHAVE_RESUMO, null);
  if (!deveEnviarResumo(agora, ultimo)) return false;
  const settings = engine.getSettings();
  const resumo = montarResumo(db, agora, settings);
  const { subject, text } = textoDoResumo(resumo);
  const r = await email.send({ to: settings.destinatarios, subject, text });
  if (r.ok) {
    db.setConfig(CHAVE_RESUMO, resumo.dia);
    log.info("resumo diario enviado", { dia: resumo.dia, entregues: resumo.entregues, pendentes: resumo.pendentes });
  }
  return r.ok;
}

export function startScheduler(intervalMin: number, engine: SyncEngine, store: Store, db: Db, email: EmailSender) {
  const ms = Math.max(1, intervalMin) * 60_000;
  const tick = async () => {
    const now = new Date();
    store.markSyncRun(now);
    const status = authStatus();
    store.setAuthState(status);
    if (emCiclo) {
      log.warn("janela pulada — ciclo anterior ainda em andamento");
      return;
    }
    emCiclo = true;
    try {
      if (status.connected) await engine.ciclo();
      else log.info("janela ignorada — Conta Azul nao conectada", { at: now.toISOString() });
      await enviarResumoSeForHora(db, engine, email, now);
    } catch (err) {
      log.error("falha na janela do agendador", { err: String(err) });
    } finally {
      emCiclo = false;
    }
  };
  void tick(); // executa uma vez ao subir
  timer = setInterval(() => void tick(), ms);
  log.info("scheduler iniciado", { intervalMin, email: email.enabled ? "ativo" : "desligado" });
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
