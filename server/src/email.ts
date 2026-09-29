// Envio de e-mails de operacao pelo Resend (HTTP, sem SMTP).
// Sem RESEND_API_KEY o modulo apenas loga: nada quebra em dev.
// Destinatarios vem da configuracao do robo (settings.destinatarios).
import { log } from "./logger.js";

export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  enabled: boolean;
  send(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }>;
}

const RESEND_URL = "https://api.resend.com/emails";

export function createResendSender(opts: {
  apiKey: string;
  from: string;
  fetcher?: typeof fetch;
}): EmailSender {
  const fetcher = opts.fetcher ?? fetch;
  const enabled = Boolean(opts.apiKey && opts.from);
  return {
    enabled,
    async send(msg) {
      if (!enabled) {
        log.info("e-mail nao enviado (RESEND_API_KEY/EMAIL_REMETENTE ausentes)", { subject: msg.subject, to: msg.to.length });
        return { ok: false, error: "email desabilitado" };
      }
      if (msg.to.length === 0) {
        log.warn("e-mail sem destinatarios; nada enviado", { subject: msg.subject });
        return { ok: false, error: "sem destinatarios" };
      }
      try {
        const res = await fetcher(RESEND_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: opts.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html ?? textoParaHtml(msg.text) }),
          signal: AbortSignal.timeout(15_000),
        });
        const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
        if (!res.ok) {
          log.error("Resend recusou o e-mail", { status: res.status, erro: body.message ?? body.name, subject: msg.subject });
          return { ok: false, error: `HTTP ${res.status}: ${body.message ?? body.name ?? "erro"}` };
        }
        log.info("e-mail enviado", { id: body.id, subject: msg.subject, to: msg.to.length });
        return { ok: true, id: body.id };
      } catch (err) {
        log.error("falha de rede ao enviar e-mail", { err: String(err), subject: msg.subject });
        return { ok: false, error: String(err) };
      }
    },
  };
}

export function createResendSenderFromEnv(): EmailSender {
  return createResendSender({ apiKey: process.env.RESEND_API_KEY ?? "", from: process.env.EMAIL_REMETENTE ?? "" });
}

/** Texto simples -> HTML minimo (paragrafos e quebras), escapando caracteres especiais. */
export function textoParaHtml(texto: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragrafos = texto.trim().split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`);
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:14px;line-height:1.5;color:#111">${paragrafos.join("")}</div>`;
}
