// Persistencia dos tokens OAuth da Conta Azul.
// Fase atual: arquivo local (gitignored). Se TOKEN_ENC_KEY estiver definido, o
// conteudo e cifrado em repouso com AES-256-GCM (o refresh_token vale ~5 anos!).
// Sem a chave, grava em texto puro e avisa — util so em dev.
// A interface (load/save/clear) foi pensada para trocar por PostgreSQL depois.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { log } from "./logger.js";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch em ms em que o access_token expira. */
  expiresAt: number;
  tokenType: string;
  scope?: string;
  obtainedAt: string;
}

const TOKENS_PATH = resolve(process.env.CA_TOKENS_PATH ?? ".tokens.json");
const ENC_KEY_RAW = process.env.TOKEN_ENC_KEY ?? "";
// Salt fixo do app: a entropia vem da TOKEN_ENC_KEY, nao do salt.
const KEY = ENC_KEY_RAW ? scryptSync(ENC_KEY_RAW, "eron-tokens-v1", 32) : null;

let warnedPlaintext = false;

function encrypt(plain: string): string {
  if (!KEY) {
    if (!warnedPlaintext) {
      log.warn("TOKEN_ENC_KEY nao definido — tokens gravados em TEXTO PURO (ok so em dev)");
      warnedPlaintext = true;
    }
    return JSON.stringify({ v: 0, data: plain });
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: tag.toString("base64"), data: enc.toString("base64") });
}

function decrypt(raw: string): string | null {
  const env = JSON.parse(raw) as { v: number; iv?: string; tag?: string; data: string };
  if (env.v === 0) return env.data;
  if (!KEY) {
    log.error("tokens cifrados mas TOKEN_ENC_KEY ausente — nao da para decifrar");
    return null;
  }
  const iv = Buffer.from(env.iv!, "base64");
  const tag = Buffer.from(env.tag!, "base64");
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(env.data, "base64")), decipher.final()]).toString("utf8");
}

let cache: StoredTokens | null = null;

export const tokenStore = {
  load(): StoredTokens | null {
    if (cache) return cache;
    if (!existsSync(TOKENS_PATH)) return null;
    try {
      const raw = readFileSync(TOKENS_PATH, "utf8");
      if (!raw.trim()) return null;
      const plain = decrypt(raw);
      if (!plain) return null;
      cache = JSON.parse(plain) as StoredTokens;
      return cache;
    } catch (err) {
      log.error("falha ao ler/decifrar tokens", { err: String(err) });
      return null;
    }
  },
  save(tokens: StoredTokens): void {
    cache = tokens;
    const dir = dirname(TOKENS_PATH);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(TOKENS_PATH, encrypt(JSON.stringify(tokens)), { encoding: "utf8", mode: 0o600 });
  },
  clear(): void {
    cache = null;
    if (existsSync(TOKENS_PATH)) writeFileSync(TOKENS_PATH, "", "utf8");
  },
  path: TOKENS_PATH,
};
