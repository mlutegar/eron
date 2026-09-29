// Persistencia em SQLite (node:sqlite, sem dependencia nativa).
// E a memoria do robo: cada parcela da Conta Azul vira uma linha, e cada passo
// (detectado, publicado, falhou...) vira um evento. E isso que garante que um
// boleto nunca sobe duas vezes, mesmo depois de reiniciar o servidor.
import type { DatabaseSync as DatabaseSyncT } from "node:sqlite";

// Carregado em tempo de execucao (Node >= 22.13): evita que o bundler dos testes
// tente resolver "node:sqlite" como se fosse um pacote npm.
const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
type DatabaseSync = DatabaseSyncT;
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Estados de uma parcela no robo. Os 4 ultimos sao os que o painel conhece. */
export type StatusParcela =
  | "IGNORADO" // sem boleto registrado (pix, cartao, sem cobranca) — reavaliada se a CA alterar
  | "REGISTRADO" // boleto registrado na CA, aguardando publicacao
  | "SINCRONIZADO" // publicado no e-Doc do Zen
  | "QUARENTENA" // falhou; nova tentativa agendada em proxima_tentativa
  | "ERRO"; // falha definitiva (esgotou as tentativas)

export interface ParcelaRow {
  id_parcela: string;
  id_cobranca: string | null;
  venda_uuid: string | null;
  venda_numero: number | null;
  cliente_nome: string;
  documento: string | null;
  valor: number;
  vencimento: string; // AAAA-MM-DD
  emitido_em: string; // data_criacao da parcela na CA (ISO)
  alterado_em_ca: string; // data_alteracao vista por ultimo na CA (ISO)
  status: StatusParcela;
  motivo: string | null;
  tentativas: number;
  proxima_tentativa: string | null; // ISO
  documento_zen_id: string | null;
  arquivo_zen_id: string | null;
  cliente_zen_id: string | null;
  sincronizado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface EventoRow {
  id: number;
  id_parcela: string;
  ts: string;
  status: StatusParcela;
  mensagem: string;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS parcelas (
  id_parcela        TEXT PRIMARY KEY,
  id_cobranca       TEXT,
  venda_uuid        TEXT,
  venda_numero      INTEGER,
  cliente_nome      TEXT NOT NULL,
  documento         TEXT,
  valor             REAL NOT NULL,
  vencimento        TEXT NOT NULL,
  emitido_em        TEXT NOT NULL,
  alterado_em_ca    TEXT NOT NULL,
  status            TEXT NOT NULL,
  motivo            TEXT,
  tentativas        INTEGER NOT NULL DEFAULT 0,
  proxima_tentativa TEXT,
  documento_zen_id  TEXT,
  arquivo_zen_id    TEXT,
  cliente_zen_id    TEXT,
  sincronizado_em   TEXT,
  criado_em         TEXT NOT NULL,
  atualizado_em     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_parcelas_status ON parcelas(status, proxima_tentativa);
CREATE INDEX IF NOT EXISTS idx_parcelas_cobranca ON parcelas(id_cobranca);
CREATE TABLE IF NOT EXISTS eventos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  id_parcela TEXT NOT NULL,
  ts         TEXT NOT NULL,
  status     TEXT NOT NULL,
  mensagem   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_eventos_parcela ON eventos(id_parcela, ts);
CREATE INDEX IF NOT EXISTS idx_eventos_ts ON eventos(ts);
CREATE TABLE IF NOT EXISTS config (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;

const COLUNAS_PATCH = new Set<keyof ParcelaRow>([
  "id_cobranca", "venda_uuid", "venda_numero", "cliente_nome", "documento", "valor", "vencimento",
  "emitido_em", "alterado_em_ca", "status", "motivo", "tentativas", "proxima_tentativa",
  "documento_zen_id", "arquivo_zen_id", "cliente_zen_id", "sincronizado_em",
]);

export class Db {
  private constructor(readonly sql: DatabaseSync) {}

  /** Abre (ou cria) o banco. `":memory:"` para testes. */
  static open(path: string): Db {
    if (path !== ":memory:") mkdirSync(dirname(resolve(path)), { recursive: true });
    const sql = new DatabaseSync(path);
    sql.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    sql.exec(SCHEMA);
    return new Db(sql);
  }

  close(): void {
    this.sql.close();
  }

  // --- parcelas ---

  getParcela(idParcela: string): ParcelaRow | undefined {
    return this.sql.prepare("SELECT * FROM parcelas WHERE id_parcela = ?").get(idParcela) as ParcelaRow | undefined;
  }

  getPorCobranca(idCobranca: string): ParcelaRow | undefined {
    return this.sql.prepare("SELECT * FROM parcelas WHERE id_cobranca = ? ORDER BY criado_em ASC LIMIT 1").get(idCobranca) as ParcelaRow | undefined;
  }

  /** Outra parcela que ja "e dona" desta cobranca (um boleto pode cobrir varias parcelas). */
  donaDaCobranca(idCobranca: string, excetoParcela: string): ParcelaRow | undefined {
    return this.sql.prepare("SELECT * FROM parcelas WHERE id_cobranca = ? AND id_parcela <> ? ORDER BY criado_em ASC LIMIT 1")
      .get(idCobranca, excetoParcela) as ParcelaRow | undefined;
  }

  inserirParcela(row: Omit<ParcelaRow, "criado_em" | "atualizado_em">, agora: string): ParcelaRow {
    this.sql.prepare(`
      INSERT INTO parcelas (id_parcela, id_cobranca, venda_uuid, venda_numero, cliente_nome, documento, valor,
        vencimento, emitido_em, alterado_em_ca, status, motivo, tentativas, proxima_tentativa, documento_zen_id,
        arquivo_zen_id, cliente_zen_id, sincronizado_em, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      row.id_parcela, row.id_cobranca, row.venda_uuid, row.venda_numero, row.cliente_nome, row.documento, row.valor,
      row.vencimento, row.emitido_em, row.alterado_em_ca, row.status, row.motivo, row.tentativas, row.proxima_tentativa,
      row.documento_zen_id, row.arquivo_zen_id, row.cliente_zen_id, row.sincronizado_em, agora, agora,
    );
    return this.getParcela(row.id_parcela)!;
  }

  atualizarParcela(idParcela: string, patch: Partial<ParcelaRow>, agora: string): ParcelaRow {
    const chaves = (Object.keys(patch) as Array<keyof ParcelaRow>).filter((k) => COLUNAS_PATCH.has(k));
    if (chaves.length === 0) return this.getParcela(idParcela)!;
    const sets = chaves.map((k) => `${k} = ?`).join(", ");
    const valores = chaves.map((k) => patch[k] as string | number | null);
    this.sql.prepare(`UPDATE parcelas SET ${sets}, atualizado_em = ? WHERE id_parcela = ?`).run(...valores, agora, idParcela);
    return this.getParcela(idParcela)!;
  }

  /** Parcelas prontas para publicar: REGISTRADO, ou QUARENTENA cuja hora de tentar chegou. */
  listarProntas(agora: string, emitidasDesde: string, limite: number): ParcelaRow[] {
    return this.sql.prepare(`
      SELECT * FROM parcelas
      WHERE id_cobranca IS NOT NULL
        AND emitido_em >= ?
        AND (status = 'REGISTRADO' OR (status = 'QUARENTENA' AND (proxima_tentativa IS NULL OR proxima_tentativa <= ?)))
      ORDER BY emitido_em ASC
      LIMIT ?
    `).all(emitidasDesde, agora, limite) as unknown as ParcelaRow[];
  }

  listarPorStatus(status: StatusParcela[], limite = 500): ParcelaRow[] {
    const marks = status.map(() => "?").join(",");
    return this.sql.prepare(`SELECT * FROM parcelas WHERE status IN (${marks}) ORDER BY atualizado_em DESC LIMIT ?`)
      .all(...status, limite) as unknown as ParcelaRow[];
  }

  listarComCobranca(limite = 1000): ParcelaRow[] {
    return this.sql.prepare("SELECT * FROM parcelas WHERE id_cobranca IS NOT NULL ORDER BY emitido_em DESC LIMIT ?")
      .all(limite) as unknown as ParcelaRow[];
  }

  // --- eventos ---

  registrarEvento(idParcela: string, status: StatusParcela, mensagem: string, ts: string): void {
    this.sql.prepare("INSERT INTO eventos (id_parcela, ts, status, mensagem) VALUES (?, ?, ?, ?)").run(idParcela, ts, status, mensagem);
  }

  listarEventos(opts: { idParcela?: string; limite?: number } = {}): EventoRow[] {
    const limite = opts.limite ?? 500;
    if (opts.idParcela) {
      return this.sql.prepare("SELECT * FROM eventos WHERE id_parcela = ? ORDER BY ts DESC, id DESC LIMIT ?")
        .all(opts.idParcela, limite) as unknown as EventoRow[];
    }
    return this.sql.prepare("SELECT * FROM eventos ORDER BY ts DESC, id DESC LIMIT ?").all(limite) as unknown as EventoRow[];
  }

  /** Eventos de sucesso desde `desde` (contadores do painel). */
  contarSincronizadosDesde(desde: string): number {
    const r = this.sql.prepare("SELECT COUNT(*) AS n FROM eventos WHERE status = 'SINCRONIZADO' AND ts >= ?").get(desde) as { n: number };
    return r.n;
  }

  /** Falhas do Zen na janela (alerta de instabilidade). */
  contarFalhasDesde(desde: string): number {
    const r = this.sql.prepare("SELECT COUNT(*) AS n FROM eventos WHERE status IN ('QUARENTENA','ERRO') AND ts >= ?").get(desde) as { n: number };
    return r.n;
  }

  // --- config (chave/valor em JSON) ---

  getConfig<T>(chave: string, padrao: T): T {
    const r = this.sql.prepare("SELECT valor FROM config WHERE chave = ?").get(chave) as { valor: string } | undefined;
    if (!r) return padrao;
    try {
      return JSON.parse(r.valor) as T;
    } catch {
      return padrao;
    }
  }

  setConfig(chave: string, valor: unknown): void {
    this.sql.prepare("INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor")
      .run(chave, JSON.stringify(valor));
  }
}
