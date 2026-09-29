// Cliente OAuth2 (Authorization Code + PKCE) + API da Conta Azul.
//
// Fluxo:
//   1. buildAuthorizeUrl(state, codeChallenge) -> usuario loga e consente
//   2. CA redireciona para CA_REDIRECT_URI com ?code=...&state=...
//   3. exchangeCode(code, codeVerifier) troca por access_token + refresh_token
//   4. getValidAccessToken() devolve token valido, renovando quando faltam <60s
//      (com singleflight: um unico refresh concorrente por vez)
//
// Endpoints/escopos configuraveis por env (defaults da documentacao Conta Azul).
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { fetchWithRetry } from "./http.js";
import { log } from "./logger.js";
import { sendAlert } from "./notify.js";
import { tokenStore, type StoredTokens } from "./tokenStore.js";

const env = (k: string, fallback = ""): string => process.env[k] ?? fallback;

const CLIENT_ID = env("CA_CLIENT_ID");
const CLIENT_SECRET = env("CA_CLIENT_SECRET");
const REDIRECT_URI = env("CA_REDIRECT_URI", "http://localhost:3001/oauth/contaazul/callback");
// Endpoints da documentacao oficial atual (developers.contaazul.com/auth e /changecode).
// O portal de devs gera a URL de autorizacao neste mesmo formato.
const AUTHORIZE_URL = env("CA_AUTHORIZE_URL", "https://login.contaazul.com/#/oauth/authorize");
const TOKEN_URL = env("CA_TOKEN_URL", "https://api-v2.contaazul.com/oauth/token");
const SCOPE = env("CA_SCOPE", "openid profile aws.cognito.signin.user.admin");
const API_BASE = env("CA_API_BASE", "https://api-v2.contaazul.com");
const PUBLIC_BASE = env("CA_PUBLIC_BASE", "https://public.contaazul.com");
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export class ContaAzulError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ContaAzulError";
  }
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET);
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

const base64url = (buf: Buffer): string => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** PKCE: gera o par verifier/challenge (S256). */
export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

/** Monta a URL de consentimento (etapa 1). */
export function buildAuthorizeUrl(state: string, codeChallenge?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${AUTHORIZE_URL}${AUTHORIZE_URL.includes("?") ? "&" : "?"}${params.toString()}`;
}

const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().default(3600),
  token_type: z.string().default("Bearer"),
  scope: z.string().optional(),
});
type TokenResponse = z.infer<typeof TokenResponseSchema>;

async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body,
    timeoutMs: 15_000,
    retries: 3,
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = text;
  }
  if (!res.ok) throw new ContaAzulError(`token endpoint respondeu ${res.status}`, res.status, json);
  const parsed = TokenResponseSchema.safeParse(json);
  if (!parsed.success) throw new ContaAzulError("resposta do token endpoint fora do contrato", res.status, parsed.error.issues);
  return parsed.data;
}

function persist(tok: TokenResponse, previousRefresh?: string): StoredTokens {
  const stored: StoredTokens = {
    accessToken: tok.access_token,
    // CA pode nao reenviar o refresh_token na renovacao — mantemos o anterior.
    refreshToken: tok.refresh_token ?? previousRefresh ?? "",
    expiresAt: Date.now() + tok.expires_in * 1000,
    tokenType: tok.token_type,
    scope: tok.scope,
    obtainedAt: new Date().toISOString(),
  };
  tokenStore.save(stored);
  return stored;
}

/** Etapa 2: troca o `code` por tokens (com code_verifier do PKCE, se houver). */
export async function exchangeCode(code: string, codeVerifier?: string): Promise<StoredTokens> {
  if (!isConfigured()) throw new ContaAzulError("CA_CLIENT_ID/CA_CLIENT_SECRET nao configurados");
  // Conforme a doc oficial: client_id/secret vao so no header Basic, nao no body.
  const body = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
  if (codeVerifier) body.set("code_verifier", codeVerifier);
  const tok = await postToken(body);
  log.info("Conta Azul conectada via authorization_code");
  return persist(tok);
}

// Singleflight: garante um unico refresh concorrente. Sem isso, dois pedidos
// simultaneos poderiam disparar dois refresh e a CA invalidaria o token antigo.
let refreshInFlight: Promise<StoredTokens> | null = null;

export function refreshAccessToken(): Promise<StoredTokens> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = doRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function doRefresh(): Promise<StoredTokens> {
  const current = tokenStore.load();
  if (!current?.refreshToken) throw new ContaAzulError("sem refresh_token — refazer o consentimento");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: current.refreshToken });
  try {
    const tok = await postToken(body);
    log.info("access_token renovado");
    return persist(tok, current.refreshToken);
  } catch (err) {
    await sendAlert("ca-refresh-fail", "Falha ao renovar token da Conta Azul", String(err));
    throw err;
  }
}

/** Devolve um access_token valido, renovando se faltar menos de 60s. */
export async function getValidAccessToken(): Promise<string> {
  const current = tokenStore.load();
  if (!current) throw new ContaAzulError("nao autenticado — inicie /oauth/contaazul/start");
  if (Date.now() < current.expiresAt - 60_000) return current.accessToken;
  const refreshed = await refreshAccessToken();
  return refreshed.accessToken;
}

/** Revoga localmente (limpa tokens) — forca reconsentimento. */
export function disconnect(): void {
  tokenStore.clear();
  log.info("tokens da Conta Azul limpos (disconnect)");
}

export interface AuthStatus {
  configured: boolean;
  connected: boolean;
  expiresAt: string | null;
  expired: boolean;
  scope: string | null;
  obtainedAt: string | null;
}

export function authStatus(): AuthStatus {
  const t = tokenStore.load();
  return {
    configured: isConfigured(),
    connected: Boolean(t?.accessToken),
    expiresAt: t ? new Date(t.expiresAt).toISOString() : null,
    expired: t ? Date.now() >= t.expiresAt : false,
    scope: t?.scope ?? null,
    obtainedAt: t?.obtainedAt ?? null,
  };
}

// --- Cliente das chamadas de API (endpoints validados em [[Arquitetura]]) ---

async function apiGet<T>(path: string, schema: z.ZodType<T>, base = API_BASE): Promise<T> {
  const token = await getValidAccessToken();
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    timeoutMs: 20_000,
    retries: 3,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ContaAzulError(`GET ${url} respondeu ${res.status}`, res.status, body);
  }
  const json = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    log.warn("resposta da CA fora do schema esperado", { url, issues: parsed.error.issues.slice(0, 5) });
    // Nao derruba: retorna o payload cru tipado como T (schemas sao permissivos).
    return json as T;
  }
  return parsed.data;
}

// Schemas permissivos: validam o que sabemos e deixam o resto passar
// (`passthrough`), para nao quebrar quando a CA acrescentar campos.
const ContaReceberSchema = z.object({}).passthrough();
const ContasReceberListSchema = z.union([z.array(ContaReceberSchema), z.object({}).passthrough()]);

export const contaAzul = {
  isConfigured,
  buildAuthorizeUrl,
  generatePkce,
  exchangeCode,
  refreshAccessToken,
  getValidAccessToken,
  disconnect,
  authStatus,

  /** 1) Busca parcelas de contas a receber. `query` = filtros da CA (datas, status...). */
  buscarContasReceber(query: Record<string, string | number> = {}): Promise<unknown> {
    const qs = new URLSearchParams(Object.entries(query).map(([k, v]): [string, string] => [k, String(v)]));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return apiGet(`/v1/financeiro/eventos-financeiros/contas-a-receber/buscar${suffix}`, ContasReceberListSchema);
  },

  /** 2) Detalhe da parcela (inclui id da cobranca). */
  detalheParcela(idParcela: string): Promise<unknown> {
    return apiGet(`/v1/financeiro/eventos-financeiros/parcelas/${encodeURIComponent(idParcela)}`, ContaReceberSchema);
  },

  /** 3) Status da cobranca. */
  statusCobranca(idCobranca: string): Promise<unknown> {
    return apiGet(`/v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/${encodeURIComponent(idCobranca)}`, ContaReceberSchema);
  },

  /**
   * 4) URL do PDF do boleto. `idCobranca` e o `id` devolvido por statusCobranca().
   * Endpoint publico da fatura (validado com a Venda 1591): nao exige token e
   * nao e documentado na API oficial — pode mudar sem aviso.
   */
  pdfBoletoUrl(idCobranca: string): string {
    return `${PUBLIC_BASE}/payments/billing/charge/file/${encodeURIComponent(idCobranca)}`;
  },

  /** Baixa o PDF do boleto. Nunca retorna HTML como se fosse PDF. */
  async baixarPdfBoleto(idCobranca: string): Promise<Uint8Array> {
    if (!/^[A-Za-z0-9-]+$/.test(idCobranca)) {
      throw new ContaAzulError("id da cobranca invalido");
    }
    // Endpoint publico: o token da Conta Azul nao e enviado (nem precisa).
    const response = await fetch(this.pdfBoletoUrl(idCobranca), {
      headers: { Accept: "application/pdf" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      throw new ContaAzulError(`download do boleto respondeu HTTP ${response.status}`, response.status);
    }
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > MAX_PDF_BYTES) throw new ContaAzulError("PDF maior que 20 MB");
    const pdf = new Uint8Array(await response.arrayBuffer());
    if (pdf.byteLength === 0 || pdf.byteLength > MAX_PDF_BYTES ||
        new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-") {
      throw new ContaAzulError("A Conta Azul nao devolveu um PDF valido");
    }
    return pdf;
  },
};
