import { describe, expect, it, vi } from "vitest";
import { Db } from "./db.js";
import { createResendSender } from "./email.js";
import { createAlerter } from "./notify.js";
import { deveEnviarResumo, montarResumo, textoDoResumo } from "./resumo.js";
import { enviarResumoSeForHora } from "./scheduler.js";
import { SyncEngine } from "./sync.js";

const okResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("Resend sender", () => {
  it("envia com from/to/subject e devolve o id", async () => {
    const fetcher = vi.fn(async () => okResponse({ id: "email-1" }));
    const sender = createResendSender({ apiKey: "re_teste", from: "IAZAN Sync <robo@exemplo.com>", fetcher: fetcher as unknown as typeof fetch });
    const r = await sender.send({ to: ["a@x.com", "b@x.com"], subject: "Oi", text: "corpo\n\nlinha 2" });
    expect(r).toEqual({ ok: true, id: "email-1" });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_teste");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ from: "IAZAN Sync <robo@exemplo.com>", to: ["a@x.com", "b@x.com"], subject: "Oi", text: "corpo\n\nlinha 2" });
    expect(body.html).toContain("<p>corpo</p><p>linha 2</p>");
  });

  it("sem chave fica desabilitado e nao chama a rede", async () => {
    const fetcher = vi.fn();
    const sender = createResendSender({ apiKey: "", from: "x <x@x.com>", fetcher: fetcher as unknown as typeof fetch });
    expect(sender.enabled).toBe(false);
    expect((await sender.send({ to: ["a@x.com"], subject: "s", text: "t" })).ok).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("erro do Resend nao lanca, devolve ok=false", async () => {
    const fetcher = vi.fn(async () => okResponse({ message: "domain not verified" }, 403));
    const sender = createResendSender({ apiKey: "re_x", from: "x <x@x.com>", fetcher: fetcher as unknown as typeof fetch });
    const r = await sender.send({ to: ["a@x.com"], subject: "s", text: "t" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("domain not verified");
  });
});

describe("alertas", () => {
  it("manda e-mail aos destinatarios atuais e respeita o cooldown por chave", async () => {
    const send = vi.fn(async (_msg: { to: string[]; subject: string; text: string }) => ({ ok: true, id: "1" }));
    let t = 0;
    let destinatarios = ["ops@x.com"];
    const alert = createAlerter({ email: { enabled: true, send }, destinatarios: () => destinatarios, webhookUrl: "", cooldownMs: 1000, now: () => t });
    await alert("k1", "Assunto", "detalhe");
    await alert("k1", "Assunto", "detalhe"); // dentro do cooldown
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: ["ops@x.com"], subject: "[IAZAN Sync] Assunto" });
    t = 2000;
    destinatarios = ["ops@x.com", "novo@x.com"];
    await alert("k1", "Assunto", "detalhe");
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toMatchObject({ to: ["ops@x.com", "novo@x.com"] });
  });
});

describe("resumo diario", () => {
  const AGORA_18H = new Date("2026-10-05T21:30:00Z"); // 18:30 Brasilia
  it("so a partir das 18h e uma vez por dia", () => {
    expect(deveEnviarResumo(new Date("2026-10-05T20:59:00Z"), null)).toBe(false); // 17:59
    expect(deveEnviarResumo(AGORA_18H, null)).toBe(true);
    expect(deveEnviarResumo(AGORA_18H, "2026-10-05")).toBe(false);
    expect(deveEnviarResumo(AGORA_18H, "2026-10-04")).toBe(true);
  });

  it("conta entregues do dia, pendentes e falhas definitivas com CPF/CNPJ", () => {
    const db = Db.open(":memory:");
    const ts = "2026-10-05T15:00:00.000Z";
    const base = { id_cobranca: "c", venda_uuid: "v", venda_numero: null as number | null, cliente_nome: "Cliente", documento: "12345678000199", valor: 100, vencimento: "2026-10-20",
      emitido_em: ts, alterado_em_ca: ts, motivo: null, tentativas: 0, proxima_tentativa: null, documento_zen_id: null, arquivo_zen_id: null, cliente_zen_id: null, sincronizado_em: null };
    db.inserirParcela({ ...base, id_parcela: "p1", id_cobranca: "c1", status: "SINCRONIZADO" as const, sincronizado_em: ts, documento_zen_id: "d" }, ts);
    db.inserirParcela({ ...base, id_parcela: "p2", id_cobranca: "c2", status: "SINCRONIZADO" as const, sincronizado_em: "2026-10-04T15:00:00.000Z" }, ts); // ontem
    db.inserirParcela({ ...base, id_parcela: "p3", id_cobranca: "c3", status: "REGISTRADO" as const }, ts);
    db.inserirParcela({ ...base, id_parcela: "p4", id_cobranca: "c4", status: "ERRO" as const, motivo: "cliente nao encontrado no Zen", venda_numero: 2299 }, ts);
    const r = montarResumo(db, AGORA_18H, { envioHabilitado: true, autoRun: true });
    expect(r).toMatchObject({ dia: "2026-10-05", entregues: 1, valorEntregue: 100, pendentes: 1, falhasDefinitivas: [{ venda: 2299, documento: "12345678000199" }] });
    const { subject, text } = textoDoResumo(r);
    expect(subject).toContain("05/10/2026");
    expect(text).toContain("Entregues no Zen hoje: 1");
    expect(text).toContain("Venda 2299");
  });

  it("agendador envia o resumo uma vez e registra o dia", async () => {
    const db = Db.open(":memory:");
    const engine = new SyncEngine({ ca: {} as never, zen: () => { throw new Error("x"); }, db, now: () => AGORA_18H });
    engine.setSettings({ destinatarios: ["ops@x.com"] });
    const send = vi.fn(async (_msg: { to: string[]; subject: string; text: string }) => ({ ok: true, id: "1" }));
    const email = { enabled: true, send };
    expect(await enviarResumoSeForHora(db, engine, email, AGORA_18H)).toBe(true);
    expect(await enviarResumoSeForHora(db, engine, email, AGORA_18H)).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: ["ops@x.com"] });
    expect(String(send.mock.calls[0][0].text)).toContain("DESABILITADO");
  });
});
