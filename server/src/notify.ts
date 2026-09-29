// Alertas de operacao: sempre logam; opcionalmente vao por webhook
// (ALERT_WEBHOOK_URL) e por e-mail (Resend) para os destinatarios configurados
// no robo. Nunca lancam — alerta nao pode derrubar o app.
import type { EmailSender } from "./email.js";
import { log } from "./logger.js";

export type Alerter = (key: string, subject: string, detail: string) => Promise<void>;

export interface AlerterOptions {
  email?: EmailSender;
  /** Lidos a cada alerta, para refletir mudancas feitas no painel. */
  destinatarios?: () => string[];
  webhookUrl?: string;
  /** Anti-spam: nao repete o mesmo `key` dentro desta janela. */
  cooldownMs?: number;
  now?: () => number;
  fetcher?: typeof fetch;
}

export function createAlerter(opts: AlerterOptions = {}): Alerter {
  const webhook = opts.webhookUrl ?? process.env.ALERT_WEBHOOK_URL ?? "";
  const cooldown = opts.cooldownMs ?? Number(process.env.ALERT_COOLDOWN_MIN ?? 30) * 60_000;
  const now = opts.now ?? (() => Date.now());
  const fetcher = opts.fetcher ?? fetch;
  const lastSent = new Map<string, number>();

  return async (key, subject, detail) => {
    const t = now();
    const prev = lastSent.get(key);
    if (prev !== undefined && t - prev < cooldown) return;
    lastSent.set(key, t);
    log.error("ALERTA", { key, subject, detail });

    if (webhook) {
      try {
        await fetcher(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `⚠️ [IAZAN Sync] ${subject}\n${detail}` }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        log.warn("falha ao enviar alerta via webhook", { err: String(err) });
      }
    }

    if (opts.email?.enabled) {
      const to = opts.destinatarios?.() ?? [];
      await opts.email.send({
        to,
        subject: `[IAZAN Sync] ${subject}`,
        text: `${subject}\n\n${detail}\n\nPainel: https://eron.mlutegar.com\nAlerta: ${key}`,
      });
    }
  };
}

/** Alerta padrao (log + webhook), usado quando o e-mail ainda nao foi configurado. */
export const sendAlert: Alerter = createAlerter();
