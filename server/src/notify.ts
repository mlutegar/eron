// Alertas ativos de saude da integracao (ex.: OAuth caiu, refresh falhou).
// Pluggavel: se ALERT_WEBHOOK_URL estiver definido, faz POST JSON (Slack/Discord
// /webhook generico). Sempre loga. Nunca lanca — alerta nao pode derrubar o app.
import { log } from "./logger.js";

const WEBHOOK = process.env.ALERT_WEBHOOK_URL ?? "";

// Anti-spam simples: nao repete o mesmo alerta em menos de N minutos.
const COOLDOWN_MS = Number(process.env.ALERT_COOLDOWN_MIN ?? 30) * 60_000;
const lastSent = new Map<string, number>();

export async function sendAlert(key: string, subject: string, detail: string): Promise<void> {
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) return;
  lastSent.set(key, now);

  log.error("ALERTA", { key, subject, detail });
  if (!WEBHOOK) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    await fetch(WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `⚠️ [eron-api] ${subject}\n${detail}` }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(t));
  } catch (err) {
    log.warn("falha ao enviar alerta via webhook", { err: String(err) });
  }
}
