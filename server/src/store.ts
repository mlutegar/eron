// Store em memoria do backend integrador (fase mock, sem dependencia de banco).
// Espelha a base ficticia do front. Quando a integracao real existir, estas
// funcoes passam a ler/gravar no PostgreSQL mantendo as mesmas assinaturas.
import type {
  Boleto,
  ClientMapping,
  LastRun,
  Overview,
  QuarantineItem,
  RunItem,
  RunResult,
  Settings,
  SyncLogEntry,
  SystemHealth,
} from "./types.js";

function boleto(b: Partial<Boleto> & Pick<Boleto, "idCobranca" | "vendaId">): Boleto {
  return {
    idParcela: `PARC-${b.vendaId}`,
    cliente: "Cliente Exemplo LTDA",
    cnpj: "00.000.000/0001-00",
    valor: 0,
    vencimento: "2026-10-10",
    status: "SINCRONIZADO",
    empresaZen: "Empresa Exemplo",
    documentoZenId: null,
    emitidoEm: "2026-09-28T09:00:00-03:00",
    sincronizadoEm: "2026-09-28T09:16:00-03:00",
    ...b,
  } as Boleto;
}

const boletos: Boleto[] = [
  boleto({ idCobranca: "CBR-1591", idParcela: "PARC-1591", vendaId: 1591, cliente: "Padaria Pao Quente LTDA", cnpj: "12.345.678/0001-90", valor: 10.0, vencimento: "2026-10-05", status: "SINCRONIZADO", empresaZen: "Padaria Pao Quente", documentoZenId: "EDOC-88213", emitidoEm: "2026-09-28T08:41:00-03:00", sincronizadoEm: "2026-09-28T08:46:00-03:00" }),
  boleto({ idCobranca: "CBR-1592", vendaId: 1592, cliente: "Auto Pecas Veloz ME", cnpj: "98.765.432/0001-11", valor: 1840.5, vencimento: "2026-10-12", status: "SINCRONIZADO", empresaZen: "Auto Pecas Veloz", documentoZenId: "EDOC-88214", emitidoEm: "2026-09-28T09:02:00-03:00", sincronizadoEm: "2026-09-28T09:16:00-03:00" }),
  boleto({ idCobranca: "CBR-1593", vendaId: 1593, cliente: "Clinica Vida Plena LTDA", cnpj: "45.111.222/0001-33", valor: 620.0, vencimento: "2026-10-08", status: "REGISTRADO", empresaZen: "Clinica Vida Plena", documentoZenId: null, sincronizadoEm: null, emitidoEm: "2026-09-28T09:31:00-03:00" }),
  boleto({ idCobranca: "CBR-1594", vendaId: 1594, cliente: "Mercado Central EIRELI", cnpj: "77.888.999/0001-55", valor: 3290.9, vencimento: "2026-10-15", status: "QUARENTENA", empresaZen: null, documentoZenId: null, sincronizadoEm: null, emitidoEm: "2026-09-28T09:44:00-03:00" }),
  boleto({ idCobranca: "CBR-1595", vendaId: 1595, cliente: "Studio Foco Fotografia", cnpj: "33.222.111/0001-77", valor: 450.0, vencimento: "2026-10-09", status: "ERRO", empresaZen: "Studio Foco", documentoZenId: null, sincronizadoEm: null, emitidoEm: "2026-09-28T09:52:00-03:00" }),
  boleto({ idCobranca: "CBR-1588", vendaId: 1588, cliente: "Escritorio Contabil Norte", cnpj: "10.203.040/0001-05", valor: 980.0, vencimento: "2026-10-03", status: "SINCRONIZADO", empresaZen: "Contabil Norte", documentoZenId: "EDOC-88190", emitidoEm: "2026-09-27T14:10:00-03:00", sincronizadoEm: "2026-09-27T14:15:00-03:00" }),
];

const syncLog: SyncLogEntry[] = [
  { id: "L-1010", boleto: boletos[4], timestamp: "2026-09-28T09:52:30-03:00", status: "ERRO", mensagem: "Falha no upload e-Doc: timeout do Web Service Zen. Reprocessamento agendado." },
  { id: "L-1009", boleto: boletos[3], timestamp: "2026-09-28T09:44:12-03:00", status: "QUARENTENA", mensagem: "CNPJ 77.888.999/0001-55 nao encontrado nas empresas do Zen." },
  { id: "L-1008", boleto: boletos[2], timestamp: "2026-09-28T09:31:05-03:00", status: "REGISTRADO", mensagem: "Cobranca registrada na Conta Azul. Aguardando proxima janela de sync." },
  { id: "L-1007", boleto: boletos[1], timestamp: "2026-09-28T09:16:00-03:00", status: "SINCRONIZADO", mensagem: "Boleto publicado no Zen (EDOC-88214) para Auto Pecas Veloz." },
  { id: "L-1006", boleto: boletos[0], timestamp: "2026-09-28T08:46:00-03:00", status: "SINCRONIZADO", mensagem: "Boleto publicado no Zen (EDOC-88213) para Padaria Pao Quente." },
  { id: "L-1005", boleto: boletos[5], timestamp: "2026-09-27T14:15:00-03:00", status: "SINCRONIZADO", mensagem: "Boleto publicado no Zen (EDOC-88190) para Contabil Norte." },
];

let quarantine: QuarantineItem[] = [
  { id: "Q-2001", boleto: boletos[3], motivo: "CNPJ nao mapeado no Zen", desde: "2026-09-28T09:44:12-03:00" },
];

const clientMap: ClientMapping[] = [
  { cnpj: "12.345.678/0001-90", clienteContaAzul: "Padaria Pao Quente LTDA", empresaZen: "Padaria Pao Quente", situacao: "MAPEADO" },
  { cnpj: "98.765.432/0001-11", clienteContaAzul: "Auto Pecas Veloz ME", empresaZen: "Auto Pecas Veloz", situacao: "MAPEADO" },
  { cnpj: "45.111.222/0001-33", clienteContaAzul: "Clinica Vida Plena LTDA", empresaZen: "Clinica Vida Plena", situacao: "MAPEADO" },
  { cnpj: "10.203.040/0001-05", clienteContaAzul: "Escritorio Contabil Norte", empresaZen: "Contabil Norte", situacao: "MAPEADO" },
  { cnpj: "33.222.111/0001-77", clienteContaAzul: "Studio Foco Fotografia", empresaZen: "Studio Foco", situacao: "MAPEADO" },
  { cnpj: "77.888.999/0001-55", clienteContaAzul: "Mercado Central EIRELI", empresaZen: null, situacao: "PENDENTE" },
];

// Estado de saude do agendador — atualizado pelo scheduler a cada janela.
const health: SystemHealth = {
  ultimaSync: "2026-09-28T09:52:00-03:00",
  proximaSync: "2026-09-28T10:07:00-03:00",
  intervaloMin: 15,
  servicos: [
    { chave: "auth-ca", nome: "Autenticacao Conta Azul (OAuth2)", estado: "OK", detalhe: "Token valido. Renovacao automatica ativa." },
    { chave: "auth-zen", nome: "Web Service Questor Zen", estado: "ATENCAO", detalhe: "1 timeout nas ultimas 24h. Monitorando." },
    { chave: "pdf", nome: "Download PDF do boleto (endpoint publico)", estado: "OK", detalhe: "public.contaazul.com respondendo normalmente." },
    { chave: "db", nome: "Banco de dados (PostgreSQL)", estado: "OK", detalhe: "Conexao saudavel. Backup diario as 03:00." },
    { chave: "scheduler", nome: "Agendador (a cada 15 min)", estado: "OK", detalhe: "Ultima execucao concluida sem erros." },
  ],
};

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const withinDays = (a: Date, b: Date, days: number) => Math.abs(a.getTime() - b.getTime()) <= days * 864e5;

function refDate(): Date {
  const latest = syncLog.reduce((max, l) => Math.max(max, new Date(l.timestamp).getTime()), 0);
  return new Date(latest || Date.now());
}

// --- Execucao do robo (tela "Ativar") ---
let running = false; // lock: impede duas execucoes simultaneas (evita boleto duplicado)
let lastRun: LastRun = null;
const settings: Settings = { autoRun: false };
let edocSeq = 90000;

/** Boleto ja publicado? (idempotencia — nunca sobe duas vezes o mesmo doc.) */
const jaPublicado = (b: Boleto) => b.status === "SINCRONIZADO" && b.documentoZenId !== null;

function pushLog(entry: Omit<SyncLogEntry, "id">) {
  syncLog.unshift({ id: `L-${Date.now()}-${syncLog.length}`, ...entry });
}

export const store = {
  getOverview(): Overview {
    const ref = refDate();
    const sinc = syncLog.filter((l) => l.status === "SINCRONIZADO");
    const valorMes = boletos
      .filter((b) => b.status === "SINCRONIZADO" && sameMonth(new Date(b.emitidoEm), ref))
      .reduce((acc, b) => acc + b.valor, 0);
    return {
      counts: {
        hoje: sinc.filter((l) => sameDay(new Date(l.timestamp), ref)).length,
        semana: sinc.filter((l) => withinDays(new Date(l.timestamp), ref, 7)).length,
        mes: sinc.filter((l) => sameMonth(new Date(l.timestamp), ref)).length,
        emQuarentena: quarantine.length,
        valorMes,
      },
      health,
      ultimos: syncLog.slice(0, 5),
    };
  },
  getSyncLogs: (): SyncLogEntry[] => [...syncLog],
  getBoletoLogs: (idCobranca: string): SyncLogEntry[] => syncLog.filter((l) => l.boleto.idCobranca === idCobranca),
  getQuarantine: (): QuarantineItem[] => [...quarantine],
  reprocess(id: string): QuarantineItem[] {
    quarantine = quarantine.filter((q) => q.id !== id);
    return [...quarantine];
  },
  getClientMap: (): ClientMapping[] => [...clientMap],
  getHealth: (): SystemHealth => health,

  /** Boletos aguardando publicacao no Zen (nao sincronizados ainda). */
  getPending: (): Boleto[] => boletos.filter((b) => !jaPublicado(b)),

  isRunning: (): boolean => running,
  getLastRun: (): LastRun => lastRun,
  getSettings: (): Settings => ({ ...settings }),
  setSettings(patch: Partial<Settings>): Settings {
    if (typeof patch.autoRun === "boolean") settings.autoRun = patch.autoRun;
    return { ...settings };
  },

  /**
   * Liga o robo: varre os boletos pendentes e tenta publicar cada um no e-Doc do
   * Zen, batendo pelo nome/CNPJ do cliente. Idempotente (pula os ja publicados) e
   * protegido por lock (nao roda duas vezes ao mesmo tempo).
   */
  runSync(now: Date = new Date()): RunResult {
    if (running) throw new Error("EXECUCAO_EM_ANDAMENTO");
    running = true;
    try {
      const pendentes = boletos.filter((b) => !jaPublicado(b));
      const motivoQuarentena = new Map(quarantine.map((q) => [q.boleto.idCobranca, q.motivo]));
      const iso = now.toISOString();

      const itens: RunItem[] = pendentes.map((b) => {
        const ok = b.empresaZen !== null;
        if (ok) {
          // Publica: gera doc, marca boleto e sai da quarentena.
          b.documentoZenId = `EDOC-${++edocSeq}`;
          b.status = "SINCRONIZADO";
          b.sincronizadoEm = iso;
          quarantine = quarantine.filter((q) => q.boleto.idCobranca !== b.idCobranca);
          const mensagem = `Boleto publicado no Zen (${b.documentoZenId}) para ${b.empresaZen}.`;
          pushLog({ boleto: b, timestamp: iso, status: "SINCRONIZADO", mensagem });
          return { boleto: { ...b }, ok: true, mensagem };
        }
        // Falha: mantem/recoloca em quarentena com o motivo.
        b.status = "QUARENTENA";
        const motivo = motivoQuarentena.get(b.idCobranca) ?? `CNPJ ${b.cnpj} nao mapeado no Zen.`;
        if (!quarantine.some((q) => q.boleto.idCobranca === b.idCobranca)) {
          quarantine.push({ id: `Q-${Date.now()}-${b.idCobranca}`, boleto: b, motivo, desde: iso });
        }
        pushLog({ boleto: b, timestamp: iso, status: "QUARENTENA", mensagem: motivo });
        return { boleto: { ...b }, ok: false, mensagem: motivo };
      });

      const subiram = itens.filter((i) => i.ok);
      const result: RunResult = {
        executadoEm: iso,
        total: itens.length,
        subiram: subiram.length,
        naoSubiram: itens.length - subiram.length,
        valorPublicado: subiram.reduce((acc, i) => acc + i.boleto.valor, 0),
        itens,
      };
      lastRun = result;
      return result;
    } finally {
      running = false;
    }
  },
  /** Marca uma execucao do agendador — chamado pelo scheduler. */
  markSyncRun(now: Date) {
    health.ultimaSync = now.toISOString();
    health.proximaSync = new Date(now.getTime() + health.intervaloMin * 60_000).toISOString();
  },
  /** Reflete o estado real do OAuth da Conta Azul no /health. */
  setAuthState(state: { connected: boolean; expired: boolean; expiresAt: string | null }) {
    const svc = health.servicos.find((s) => s.chave === "auth-ca");
    if (!svc) return;
    if (!state.connected) {
      svc.estado = "FALHA";
      svc.detalhe = "Nao conectado — concluir consentimento em /oauth/contaazul/start.";
    } else if (state.expired) {
      svc.estado = "ATENCAO";
      svc.detalhe = "Token expirado; renovando no proximo uso.";
    } else {
      svc.estado = "OK";
      svc.detalhe = `Token valido${state.expiresAt ? ` ate ${state.expiresAt}` : ""}. Renovacao automatica ativa.`;
    }
  },
};
