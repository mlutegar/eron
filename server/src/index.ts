// Backend integrador IAZAN (Conta Azul -> Questor Zen).
// Serve o contrato consumido pelo dashboard (src/api/client.ts), o fluxo OAuth
// da Conta Azul e o agendador do robo. Estado persistido em SQLite (db.ts).
import "dotenv/config";
import { randomBytes } from "node:crypto";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { AuthService } from "./auth.js";
import { authStatus, buildAuthorizeUrl, contaAzul, disconnect, exchangeCode, generatePkce, isConfigured } from "./contaazul.js";
import { Db } from "./db.js";
import { log } from "./logger.js";
import { sendAlert } from "./notify.js";
import { startScheduler } from "./scheduler.js";
import { createStore } from "./store.js";
import { SyncEngine, SyncError } from "./sync.js";
import { SettingsSchema } from "./types.js";
import { zenFromEnv } from "./zen.js";

const PORT = Number(process.env.PORT ?? 3001);
const API_TOKEN = process.env.API_TOKEN ?? "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";
const INTERVAL_MIN = Number(process.env.SYNC_INTERVAL_MIN ?? 10);
const DB_PATH = process.env.DB_PATH ?? ".eron.db";

const db = Db.open(DB_PATH);
const engine = new SyncEngine({ ca: contaAzul, zen: () => zenFromEnv(), db, alert: sendAlert });
const store = createStore(db, engine, INTERVAL_MIN);
const auth = new AuthService(db, process.env.SESSION_SECRET ?? "");

const app = express();
app.set("trust proxy", true); // atras do nginx/tunnel: IP real para o limite de tentativas de login
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

// --- Login do painel (publico) ---
app.post("/auth/login", (req: Request, res: Response) => {
  const { usuario, senha } = (req.body ?? {}) as { usuario?: unknown; senha?: unknown };
  if (typeof usuario !== "string" || typeof senha !== "string") {
    return res.status(400).json({ error: "CREDENCIAIS_INVALIDAS", mensagem: "Informe usuario e senha." });
  }
  if (auth.bloqueado(req.ip ?? "")) {
    return res.status(429).json({ error: "MUITAS_TENTATIVAS", mensagem: "Muitas tentativas. Aguarde 1 minuto." });
  }
  const r = auth.login(usuario, senha, req.ip ?? "");
  if (!r) {
    log.warn("login recusado", { usuario: usuario.slice(0, 80), ip: req.ip });
    return res.status(401).json({ error: "CREDENCIAIS_INVALIDAS", mensagem: "Usuario ou senha invalidos." });
  }
  log.info("login ok", { usuario: r.sessao.sub, ip: req.ip });
  res.json({ token: r.token, usuario: r.sessao.sub, expiraEm: new Date(r.sessao.exp * 1000).toISOString() });
});

// Acesso as rotas da API: API_TOKEN (integracoes) ou sessao do painel.
// Sem API_TOKEN e sem usuarios cadastrados, fica aberta (dev) — o log avisa no boot.
const bearer = (req: Request): string => (req.header("authorization") ?? "").replace(/^Bearer\s+/i, "");
app.use((req: Request, res: Response, next: NextFunction) => {
  const token = bearer(req);
  if (API_TOKEN && token === API_TOKEN) return next();
  if (auth.temUsuarios()) {
    if (token && auth.validar(token)) return next();
    return res.status(401).json({ error: "NAO_AUTORIZADO", mensagem: "Sessao ausente ou expirada. Entre novamente." });
  }
  if (!API_TOKEN) return next();
  return res.status(401).json({ error: "NAO_AUTORIZADO", mensagem: "nao autorizado" });
});

app.get("/auth/me", (req, res) => {
  const sessao = auth.validar(bearer(req));
  res.json(sessao ? { usuario: sessao.sub, expiraEm: new Date(sessao.exp * 1000).toISOString() } : { usuario: null });
});
app.post("/auth/logout", (_req, res) => res.json({ ok: true })); // sessao sem estado: o painel descarta o token

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
  if (!parsed.success) return res.status(400).json({ error: "settings invalido", issues: parsed.error.issues });
  const next = store.setSettings(parsed.data);
  log.info("settings alterados", { ...next, destinatarios: next.destinatarios.length });
  res.json(next);
});

app.post("/run", async (_req, res) => {
  // Sessao da Conta Azul: se configurada e nao conectada, orienta o operador.
  if (isConfigured() && !authStatus().connected) {
    return res.status(503).json({
      error: "CA_NAO_CONECTADA",
      mensagem: "Sessao da Conta Azul expirada. Conclua o consentimento (codigo do banco) em /oauth/contaazul/start.",
    });
  }
  try {
    const result = await store.runSync();
    if (result.naoSubiram > 0) {
      await sendAlert(
        "run-parcial",
        `Execucao com ${result.naoSubiram} boleto(s) nao publicado(s)`,
        `subiram=${result.subiram} naoSubiram=${result.naoSubiram} valor=${result.valorPublicado}`,
      );
    }
    log.info("execucao manual do robo concluida", { subiram: result.subiram, naoSubiram: result.naoSubiram });
    ok(res, result);
  } catch (err) {
    if (err instanceof SyncError) {
      const status = err.code === "EXECUCAO_EM_ANDAMENTO" ? 409 : 503;
      return res.status(status).json({ error: err.code, mensagem: err.message });
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

startScheduler(INTERVAL_MIN, engine, store);
app.listen(PORT, () => {
  const modoAuth = auth.temUsuarios() ? "sessao do painel" + (API_TOKEN ? " + API_TOKEN" : "") : API_TOKEN ? "API_TOKEN" : "ABERTA (sem usuarios e sem API_TOKEN)";
  log.info("iazan-sync-api ouvindo", { port: PORT, auth: modoAuth, db: DB_PATH, settings: engine.getSettings() });
});
