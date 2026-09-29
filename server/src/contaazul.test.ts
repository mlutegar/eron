// Testes do cliente OAuth da Conta Azul. Isola tokens num arquivo temporario
// e mocka o fetch global. Precisa configurar env ANTES de importar o modulo.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.CA_CLIENT_ID = "test-client";
process.env.CA_CLIENT_SECRET = "test-secret";
process.env.CA_REDIRECT_URI = "http://localhost:3001/oauth/contaazul/callback";
process.env.CA_TOKENS_PATH = join(mkdtempSync(join(tmpdir(), "eron-tok-")), ".tokens.json");
delete process.env.TOKEN_ENC_KEY;

const { buildAuthorizeUrl, generatePkce, exchangeCode, getValidAccessToken, refreshAccessToken, authStatus, disconnect } = await import("./contaazul.js");

function tokenResponse(body: Record<string, unknown>, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

describe("contaazul OAuth", () => {
  beforeEach(() => disconnect());
  afterEach(() => vi.restoreAllMocks());

  it("buildAuthorizeUrl inclui params e PKCE S256", () => {
    const { challenge } = generatePkce();
    const url = new URL(buildAuthorizeUrl("st4te", challenge));
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("test-client");
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("code_challenge")).toBe(challenge);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("generatePkce gera verifier/challenge diferentes a cada chamada", () => {
    const a = generatePkce();
    const b = generatePkce();
    expect(a.verifier).not.toBe(b.verifier);
    expect(a.challenge).not.toBe(a.verifier);
  });

  it("exchangeCode persiste tokens e marca conectado", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      tokenResponse({ access_token: "A1", refresh_token: "R1", expires_in: 3600, token_type: "Bearer", scope: "openid" }),
    );
    const tok = await exchangeCode("code123", "verifier");
    expect(tok.accessToken).toBe("A1");
    expect(tok.refreshToken).toBe("R1");
    expect(authStatus().connected).toBe(true);
  });

  it("getValidAccessToken renova quando expirado e mantem refresh_token se a CA nao reenviar", async () => {
    // 1) primeira obtencao ja expirada
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(tokenResponse({ access_token: "OLD", refresh_token: "R1", expires_in: -10, token_type: "Bearer" }));
    await exchangeCode("code", "v");
    // 2) refresh(s) seguintes nao reenviam refresh_token (mock persistente)
    fetchMock.mockResolvedValue(tokenResponse({ access_token: "NEW", expires_in: 3600, token_type: "Bearer" }));
    const token = await getValidAccessToken();
    expect(token).toBe("NEW");
    // refresh_token antigo preservado
    const refreshed = await refreshAccessToken();
    expect(refreshed.refreshToken).toBe("R1");
  });

  it("propaga erro do token endpoint (4xx nao vira sucesso)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(tokenResponse({ error: "invalid_grant" }, 400));
    await expect(exchangeCode("bad", "v")).rejects.toThrow(/respondeu 400/);
  });
});
