// Backend integrador IAZAN (Conta Azul -> Questor Zen).
// Serve o contrato consumido pelo dashboard (src/api/client.ts).
// Fase atual: dados em memoria (store) + agendador stub. Estrutura pronta
// para trocar o store por PostgreSQL e o scheduler pela integracao real.
import "dotenv/config";
import { randomBytes } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { authStatus, buildAuthorizeUrl, disconnect, exchangeCode, generatePkce, isConfigured } from "./contaazul.js";
import { log } from "./logger.js";
import { DEMO_MODE } from "./mode.js";
import { sendAlert } from "./notify.js";
import { startScheduler } from "./scheduler.js";
import { store } from "./store.js";
import { SettingsSchema } from "./types.js";

const PORT = Number(process.env.PORT ?? 3001);
const API_TOKEN = process.env.API_TOKEN ?? "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";
const INTERVAL_MIN = Number(process.env.SYNC_INTERVAL_MIN ?? 15);

const app = express();
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN === "*" ? true : ALLOWED_ORIGIN.split(",").map((s) => s.trim()) }));

// Healthcheck do container — sempre publico, sem auth.
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));

// --- OAuth2 Conta Azul (fluxo de browser — publico, fora do Bearer) ---
// `state` de uso unico (anti-CSRF) + code_verifier do PKCE, com expiracao.
interface PendingAuth {
  verifier: string;
  expiresAt: number;
}
const pending = new Map<string, PendingAuth>();
const STATE_TTL_MS = 10 * 60_000;

function purgeExpired() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expiresAt < now) pending.delete(k);
}

function page(title: string, body: string, ok = true): string {
  const color = ok ? "#16a34a" : "#dc2626";
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:12vh auto;padding:2rem;text-align:center">
<h1 style="color:${color};font-size:1.4rem">${title}</h1><p style="color:#334155">${body}</p></div>`;
}

app.get("/oauth/contaazul/start", (_req, res) => {
  if (!isConfigured()) {
    return res.status(500).send(page("Configuracao ausente", "Defina CA_CLIENT_ID e CA_CLIENT_SECRET no .env.", false));
  }
  purgeExpired();
  const state = randomBytes(16).toString("hex");
  const { verifier, challenge } = generatePkce();
  pending.set(state, { verifier, expiresAt: Date.now() + STATE_TTL_MS });
  res.redirect(buildAuthorizeUrl(state, challenge));
});

app.get("/oauth/contaazul/callback", async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error) return res.status(400).send(page("Autorizacao recusada", "Reinicie a conexao e tente novamente.", false));
  if (!code || !state) return res.status(400).send(page("Callback invalido", "Faltam 'code' ou 'state'.", false));
  purgeExpired();
  const entry = pending.get(state);
  if (!entry) return res.status(400).send(page("Sessao expirada", "Reinicie em /oauth/contaazul/start.", false));
  pending.delete(state);
  try {
    const tok = await exchangeCode(code, entry.verifier);
    store.setAuthState(authStatus());
    log.info("Conta Azul conectada via callback", { expiresAt: new Date(tok.expiresAt).toISOString() });
    res.send(page("Conta Azul conectada ✅", "Integracao autorizada com sucesso. Pode fechar esta aba."));
  } catch (err) {
    log.error("falha ao trocar code", { err: String(err) });
    res.status(502).send(page("Falha ao conectar", "Nao foi possivel obter o token. Veja os logs do servidor.", false));
  }
});

app.get("/oauth/contaazul/status", (_req, res) => res.json(authStatus()));

app.post("/oauth/contaazul/disconnect", (_req, res) => {
  disconnect();
  store.setAuthState(authStatus());
  res.json({ ok: true, ...authStatus() });
});

// Auth Bearer opcional: so exige token se API_TOKEN estiver definido.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!API_TOKEN) return next();
  const header = req.header("authorization") ?? "";
  if (header === `Bearer ${API_TOKEN}`) return next();
  return res.status(401).json({ error: "nao autorizado" });
});

const ok = <T>(res: Response, data: T) => res.json(data);

app.get("/overview", (_req, res) => ok(res, store.getOverview()));
app.get("/sync-logs", (_req, res) => ok(res, store.getSyncLogs()));
app.get("/boletos/:id/logs", (req, res) => ok(res, store.getBoletoLogs(req.params.id)));
app.get("/quarantine", (_req, res) => ok(res, store.getQuarantine()));
app.post("/quarantine/:id/reprocess", (req, res) => ok(res, store.reprocess(req.params.id)));
app.get("/clients", (_req, res) => ok(res, store.getClientMap()));
app.get("/health", (_req, res) => ok(res, store.getHealth()));

// --- Ativador do robo (tela inicial "Ativar") ---
app.get("/pending", (_req, res) => ok(res, store.getPending()));
app.get("/last-run", (_req, res) => ok(res, store.getLastRun()));

app.get("/settings", (_req, res) => ok(res, store.getSettings()));
app.post("/settings", (req, res) => {
  const parsed = SettingsSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "settings invalido" });
  if (!DEMO_MODE && parsed.data.autoRun === true) {
    return res.status(503).json({ error: "INTEGRACAO_EM_HOMOLOGACAO", mensagem: "Envio automatico ainda nao disponivel." });
  }
  res.json(store.setSettings(parsed.data));
});

app.post("/run", async (_req, res) => {
  if (!DEMO_MODE) {
    return res.status(503).json({
      error: "INTEGRACAO_EM_HOMOLOGACAO",
      mensagem: "O envio real de boletos ainda nao foi ativado. Nenhum documento foi publicado.",
    });
  }
  // Trava contra clique duplo / execucao concorrente (evita boleto duplicado).
  if (store.isRunning()) {
    return res.status(409).json({ error: "EXECUCAO_EM_ANDAMENTO", mensagem: "Ja existe uma execucao em andamento." });
  }
  // Sessao do banco/Conta Azul: se configurada e nao conectada, orienta o operador.
  if (isConfigured() && !authStatus().connected) {
    return res.status(503).json({
      error: "CA_NAO_CONECTADA",
      mensagem: "Sessao da Conta Azul expirada. Conclua o consentimento (codigo do banco) em /oauth/contaazul/start.",
    });
  }
  try {
    const result = store.runSync();
    if (result.naoSubiram > 0) {
      await sendAlert(
        "run-parcial",
        `Execucao com ${result.naoSubiram} boleto(s) nao publicado(s)`,
        `subiram=${result.subiram} naoSubiram=${result.naoSubiram} valor=${result.valorPublicado}`,
      );
    }
    log.info("execucao do robo concluida", { subiram: result.subiram, naoSubiram: result.naoSubiram });
    ok(res, result);
  } catch (err) {
    if (String(err).includes("EXECUCAO_EM_ANDAMENTO")) {
      return res.status(409).json({ error: "EXECUCAO_EM_ANDAMENTO" });
    }
    throw err;
  }
});

app.use((_req, res) => res.status(404).json({ error: "rota nao encontrada" }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error("erro nao tratado", { err: String(err) });
  res.status(500).json({ error: "erro interno" });
});

startScheduler(INTERVAL_MIN);
app.listen(PORT, () => {
  log.info("iazan-sync-api ouvindo", { port: PORT, auth: API_TOKEN ? "bearer" : "aberta" });
});
