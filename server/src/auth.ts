// Autenticacao do painel: usuarios com senha (scrypt) no SQLite e sessao em
// token assinado (HMAC-SHA256), sem estado no servidor.
//
// Regra de acesso as rotas da API:
//   - se API_TOKEN estiver definido, `Authorization: Bearer <API_TOKEN>` continua valendo
//     (integracoes/scripts);
//   - se houver ao menos um usuario cadastrado, tambem vale um token de sessao valido;
//   - sem API_TOKEN e sem usuarios, a API fica aberta (so faz sentido em dev) e o log avisa.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { Db } from "./db.js";
import { log } from "./logger.js";

const SESSAO_HORAS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

export interface Sessao {
  sub: string; // login
  iat: number; // epoch s
  exp: number; // epoch s
}

const b64url = (buf: Buffer): string => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64url = (s: string): Buffer => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export function hashSenha(senha: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(senha, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${b64url(salt)}$${b64url(hash)}`;
}

export function verificarSenha(senha: string, armazenado: string): boolean {
  const [alg, n, salt, hash] = armazenado.split("$");
  if (alg !== "scrypt" || !n || !salt || !hash) return false;
  const esperado = deB64url(hash);
  const calculado = scryptSync(senha, deB64url(salt), esperado.length, { N: Number(n), r: SCRYPT.r, p: SCRYPT.p });
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export class AuthService {
  private readonly secret: Buffer;
  // Anti forca-bruta simples: falhas por IP na ultima janela.
  private readonly falhas = new Map<string, number[]>();
  private static readonly JANELA_MS = 60_000;
  private static readonly MAX_FALHAS = 5;

  constructor(private readonly db: Db, secret: string, private readonly now: () => Date = () => new Date()) {
    if (!secret) {
      log.warn("SESSION_SECRET nao definido — sessoes do painel caem a cada reinicio (ok so em dev)");
      secret = randomBytes(32).toString("hex");
    }
    this.secret = Buffer.from(secret, "utf8");
    db.sql.exec(`CREATE TABLE IF NOT EXISTS usuarios (
      login TEXT PRIMARY KEY,
      senha_hash TEXT NOT NULL,
      criado_em TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )`);
  }

  // --- usuarios ---

  criarOuAtualizarUsuario(login: string, senha: string): void {
    const l = normalizarLogin(login);
    if (!/^[a-z0-9._@-]{3,80}$/.test(l)) throw new Error("login invalido (3-80 caracteres: letras, numeros, . _ @ -)");
    if (senha.length < 8) throw new Error("senha muito curta (minimo 8 caracteres)");
    const ts = this.now().toISOString();
    this.db.sql.prepare(`INSERT INTO usuarios (login, senha_hash, criado_em, atualizado_em) VALUES (?, ?, ?, ?)
      ON CONFLICT(login) DO UPDATE SET senha_hash = excluded.senha_hash, atualizado_em = excluded.atualizado_em`)
      .run(l, hashSenha(senha), ts, ts);
  }

  removerUsuario(login: string): boolean {
    const r = this.db.sql.prepare("DELETE FROM usuarios WHERE login = ?").run(normalizarLogin(login));
    return Number(r.changes) > 0;
  }

  listarUsuarios(): Array<{ login: string; criado_em: string; atualizado_em: string }> {
    return this.db.sql.prepare("SELECT login, criado_em, atualizado_em FROM usuarios ORDER BY login").all() as unknown as Array<{ login: string; criado_em: string; atualizado_em: string }>;
  }

  temUsuarios(): boolean {
    const r = this.db.sql.prepare("SELECT COUNT(*) AS n FROM usuarios").get() as { n: number };
    return r.n > 0;
  }

  // --- login / sessao ---

  /** Devolve o token de sessao ou null. `origem` (IP) alimenta o limite de tentativas. */
  login(login: string, senha: string, origem: string): { token: string; sessao: Sessao } | null {
    if (this.bloqueado(origem)) return null;
    const row = this.db.sql.prepare("SELECT senha_hash FROM usuarios WHERE login = ?").get(normalizarLogin(login)) as { senha_hash: string } | undefined;
    // Compara mesmo sem usuario para nao vazar existencia pelo tempo de resposta.
    const ok = verificarSenha(senha, row?.senha_hash ?? hashSenha("senha-inexistente"));
    if (!ok || !row) {
      this.registrarFalha(origem);
      return null;
    }
    this.falhas.delete(origem);
    return this.emitir(normalizarLogin(login));
  }

  bloqueado(origem: string): boolean {
    const agora = this.now().getTime();
    const recentes = (this.falhas.get(origem) ?? []).filter((t) => agora - t < AuthService.JANELA_MS);
    this.falhas.set(origem, recentes);
    return recentes.length >= AuthService.MAX_FALHAS;
  }

  private registrarFalha(origem: string): void {
    const lista = this.falhas.get(origem) ?? [];
    lista.push(this.now().getTime());
    this.falhas.set(origem, lista);
  }

  emitir(sub: string): { token: string; sessao: Sessao } {
    const iat = Math.floor(this.now().getTime() / 1000);
    const sessao: Sessao = { sub, iat, exp: iat + SESSAO_HORAS * 3600 };
    const corpo = b64url(Buffer.from(JSON.stringify(sessao), "utf8"));
    return { token: `${corpo}.${this.assinar(corpo)}`, sessao };
  }

  validar(token: string): Sessao | null {
    const [corpo, assinatura] = token.split(".");
    if (!corpo || !assinatura) return null;
    const esperada = Buffer.from(this.assinar(corpo));
    const recebida = Buffer.from(assinatura);
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
    try {
      const sessao = JSON.parse(deB64url(corpo).toString("utf8")) as Sessao;
      if (typeof sessao.sub !== "string" || typeof sessao.exp !== "number") return null;
      if (sessao.exp * 1000 <= this.now().getTime()) return null;
      return sessao;
    } catch {
      return null;
    }
  }

  private assinar(corpo: string): string {
    return b64url(createHmac("sha256", this.secret).update(corpo).digest());
  }
}

export function normalizarLogin(login: string): string {
  return login.trim().toLowerCase();
}
