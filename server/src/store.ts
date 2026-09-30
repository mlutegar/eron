// Leitura do painel a partir do banco (SQLite) e do estado do motor.
// Mantem o contrato consumido pelo front (src/api/client.ts).
import type { Db, ParcelaRow } from "./db.js";
import { paraBoleto, type SyncEngine } from "./sync.js";
import type {
  Boleto, ClientMapping, LastRun, Overview, QuarantineItem, RunResult, Settings, SyncLogEntry, SystemHealth,
} from "./types.js";

export interface AuthState {
  connected: boolean;
  expired: boolean;
  expiresAt: string | null;
}

export function createStore(db: Db, engine: SyncEngine, intervaloMin: number) {
  let auth: AuthState = { connected: false, expired: false, expiresAt: null };
  let ultimaSync = "";
  let proximaSync = "";
  let ultimoErroZen: string | null = null;

  const boletoDe = (idParcela: string): Boleto | null => {
    const row = db.getParcela(idParcela);
    return row ? paraBoleto(row) : null;
  };

  const logs = (rows: ReturnType<Db["listarEventos"]>): SyncLogEntry[] =>
    rows.flatMap((e) => {
      const boleto = boletoDe(e.id_parcela);
      return boleto ? [{ id: String(e.id), boleto, timestamp: e.ts, status: e.status === "IGNORADO" ? "REGISTRADO" : e.status, mensagem: e.mensagem }] : [];
    });

  const quarentena = (): QuarantineItem[] =>
    db.listarPorStatus(["QUARENTENA", "ERRO"]).map((r: ParcelaRow) => ({
      id: r.id_parcela,
      boleto: paraBoleto(r),
      motivo: r.motivo ?? "Falha ao publicar.",
      desde: r.atualizado_em,
    }));

  function health(): SystemHealth {
    const s = engine.getSettings();
    const servicos: SystemHealth["servicos"] = [
      {
        chave: "auth-ca", nome: "Autenticacao Conta Azul (OAuth2)",
        estado: !auth.connected ? "FALHA" : auth.expired ? "ATENCAO" : "OK",
        detalhe: !auth.connected
          ? "Nao conectado — concluir consentimento em /oauth/contaazul/start."
          : auth.expired ? "Token expirado; renovando no proximo uso."
            : `Token valido${auth.expiresAt ? ` ate ${auth.expiresAt}` : ""}. Renovacao automatica ativa.`,
      },
      {
        chave: "auth-zen", nome: "Web Service Questor Zen",
        estado: ultimoErroZen ? "ATENCAO" : "OK",
        detalhe: ultimoErroZen ? `Ultima falha: ${ultimoErroZen}` : "Sem falhas registradas nesta sessao.",
      },
      { chave: "pdf", nome: "Download PDF do boleto (endpoint publico)", estado: "OK", detalhe: "Validado com boleto real em 29/09/2026." },
      { chave: "db", nome: "Banco de dados (SQLite)", estado: "OK", detalhe: `${db.listarComCobranca(100000).length} boleto(s) registrados.` },
      {
        chave: "scheduler", nome: `Agendador (a cada ${intervaloMin} min)`,
        estado: s.envioHabilitado && s.autoRun ? "OK" : "ATENCAO",
        detalhe: !s.envioHabilitado
          ? "Envio ao Zen DESABILITADO (chave geral). Deteccao continua ativa."
          : s.autoRun ? `Publicacao automatica ligada (7h-19h). Data de corte: ${s.dataCorte}.` : "Publicacao automatica desligada; so pelo botao Ativar.",
      },
    ];
    return { ultimaSync, proximaSync, intervaloMin, servicos };
  }

  return {
    getOverview(): Overview {
      const agora = new Date();
      const inicioDia = new Date(agora); inicioDia.setHours(0, 0, 0, 0);
      const inicioSemana = new Date(agora.getTime() - 7 * 864e5);
      const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const sincMes = db.listarPorStatus(["SINCRONIZADO"], 100000).filter((r) => (r.sincronizado_em ?? "") >= inicioMes.toISOString());
      return {
        counts: {
          hoje: db.contarSincronizadosDesde(inicioDia.toISOString()),
          semana: db.contarSincronizadosDesde(inicioSemana.toISOString()),
          mes: db.contarSincronizadosDesde(inicioMes.toISOString()),
          emQuarentena: quarentena().length,
          valorMes: sincMes.reduce((acc, r) => acc + r.valor, 0),
        },
        health: health(),
        ultimos: logs(db.listarEventos({ limite: 5 })),
      };
    },
    getSyncLogs: (): SyncLogEntry[] => logs(db.listarEventos({ limite: 500 })),
    getBoletoLogs(idCobranca: string): SyncLogEntry[] {
      const row = db.getPorCobranca(idCobranca) ?? db.getParcela(idCobranca);
      return row ? logs(db.listarEventos({ idParcela: row.id_parcela })) : [];
    },
    getQuarantine: quarentena,
    /** "Reprocessar": libera a parcela para a proxima rodada (nao publica na hora). */
    reprocess(idParcela: string): QuarantineItem[] {
      const row = db.getParcela(idParcela);
      if (row && (row.status === "QUARENTENA" || row.status === "ERRO")) {
        const ts = new Date().toISOString();
        db.atualizarParcela(idParcela, { status: "QUARENTENA", proxima_tentativa: ts, tentativas: row.status === "ERRO" ? 0 : row.tentativas }, ts);
        db.registrarEvento(idParcela, "QUARENTENA", "Reprocessamento solicitado pelo operador; entra na proxima rodada.", ts);
      }
      return quarentena();
    },
    getClientMap(): ClientMapping[] {
      const vistos = new Map<string, ClientMapping>();
      for (const r of db.listarComCobranca(100000)) {
        const chave = r.documento ?? `sem-doc:${r.cliente_nome}`;
        const atual = vistos.get(chave);
        const mapeado = Boolean(r.cliente_zen_id);
        if (!atual || (mapeado && atual.situacao === "PENDENTE")) {
          vistos.set(chave, { cnpj: r.documento ?? "", clienteContaAzul: r.cliente_nome, empresaZen: mapeado ? r.cliente_nome : null, situacao: mapeado ? "MAPEADO" : "PENDENTE" });
        }
      }
      return [...vistos.values()];
    },
    getHealth: health,
    /** Pendentes que o robo de fato vai publicar: respeita a data de corte, quando definida. */
    getPending(): Boleto[] {
      const corte = engine.getSettings().dataCorte;
      const desde = corte ? `${corte}T00:00:00` : "";
      return db.listarPorStatus(["REGISTRADO", "QUARENTENA"], 1000).filter((r) => r.emitido_em >= desde).map(paraBoleto);
    },
    isRunning: (): boolean => engine.isRunning(),
    getLastRun: (): LastRun => engine.getLastRun(),
    getSettings: (): Settings => engine.getSettings(),
    setSettings: (patch: Partial<Settings>): Settings => engine.setSettings(patch),
    runSync: (): Promise<RunResult> => engine.entregar({ manual: true }),
    markSyncRun(now: Date) {
      ultimaSync = now.toISOString();
      proximaSync = new Date(now.getTime() + intervaloMin * 60_000).toISOString();
    },
    setAuthState(state: AuthState) {
      auth = state;
    },
    setZenError(msg: string | null) {
      ultimoErroZen = msg;
    },
  };
}

export type Store = ReturnType<typeof createStore>;
