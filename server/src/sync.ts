// Motor do robo: detecta boletos novos na Conta Azul e os publica no e-Doc do Zen.
//
// Ciclo (chamado pelo agendador):
//   1. detectar()  — 24h por dia, so leitura na CA: parcelas alteradas na janela
//                    (10 dias, nunca antes da data de corte) viram linhas no banco.
//   2. entregar()  — so se envioHabilitado E (manual OU autoRun dentro do horario
//                    7h-19h): publica as pendentes, ate o limite por rodada.
//
// Idempotencia: a chave e o id da parcela/cobranca no banco; antes de publicar
// relemos a linha e pulamos se ja estiver SINCRONIZADO. Um lock impede rodadas
// simultaneas. Toda falha agenda nova tentativa (1h, 6h, 1d, 3d, 7d, 30d); na
// 7a vira falha definitiva (ERRO) e dispara alerta.
import type { Db, ParcelaRow } from "./db.js";
import { log } from "./logger.js";
import {
  FUSO, MAX_FALHAS, agendarProximaTentativa, avaliarElegibilidade, dataEmBrasilia, dataEmissaoBoleto, dentroDoHorarioDeEntrega,
  janelaDeDeteccao, nomeArquivo, tituloDocumento, type ParcelaDetalhe,
} from "./regras.js";
import type { Boleto, RunItem, RunResult, Settings } from "./types.js";
import type { ZenBoletoInput, ZenPublishResult } from "./zen.js";

export interface CaPort {
  buscarContasReceber(query: Record<string, string | number>): Promise<unknown>;
  detalheParcela(idParcela: string): Promise<unknown>;
  detalheVenda(idVenda: string): Promise<unknown>;
  statusCobranca(idCobranca: string): Promise<unknown>;
  baixarPdfBoleto(idCobranca: string): Promise<Uint8Array>;
}

export interface ZenPort {
  publishBoleto(input: ZenBoletoInput): Promise<ZenPublishResult>;
}

export interface SyncDeps {
  ca: CaPort;
  /** Construido sob demanda: so e preciso na hora de publicar. */
  zen: () => ZenPort;
  db: Db;
  now?: () => Date;
  alert?: (key: string, subject: string, detail: string) => Promise<void>;
}

export class SyncError extends Error {
  constructor(readonly code: "EXECUCAO_EM_ANDAMENTO" | "ENVIO_DESABILITADO" | "SEM_DATA_CORTE" | "FORA_DO_HORARIO", message: string) {
    super(message);
    this.name = "SyncError";
  }
}

export const SETTINGS_PADRAO: Settings = {
  autoRun: false,
  envioHabilitado: false,
  dataCorte: null,
  limitePorRodada: 20,
  destinatarios: [],
};

interface ItemBusca {
  id: string;
  descricao?: string;
  total?: number;
  nao_pago?: number;
  data_vencimento?: string;
  data_criacao?: string;
  data_alteracao?: string;
  status_traduzido?: string;
  cliente?: { id?: string; nome?: string };
}

interface VendaDetalhe {
  cliente?: { nome?: string; documento?: string };
  venda?: { id?: string; numero?: number };
}

const TAMANHO_PAGINA = 100;
const MAX_PAGINAS = 50;

export class SyncEngine {
  private running = false;
  private readonly now: () => Date;
  private readonly alert: NonNullable<SyncDeps["alert"]>;

  constructor(private readonly deps: SyncDeps) {
    this.now = deps.now ?? (() => new Date());
    this.alert = deps.alert ?? (async () => {});
  }

  isRunning(): boolean {
    return this.running;
  }

  getSettings(): Settings {
    return { ...SETTINGS_PADRAO, ...this.deps.db.getConfig<Partial<Settings>>("settings", {}) };
  }

  /**
   * Aplica um patch de configuracao. Ao habilitar o envio pela primeira vez sem
   * data de corte, a data de corte vira HOJE — nunca publicamos o passado sem
   * alguem escolher isso de proposito.
   */
  setSettings(patch: Partial<Settings>): Settings {
    const atual = this.getSettings();
    const next: Settings = { ...atual, ...patch };
    if (next.envioHabilitado && !next.dataCorte) next.dataCorte = dataEmBrasilia(this.now());
    this.deps.db.setConfig("settings", next);
    return next;
  }

  getLastRun(): RunResult | null {
    return this.deps.db.getConfig<RunResult | null>("lastRun", null);
  }

  // ------------------------------------------------------------------ detectar

  /** Le a CA e registra parcelas novas/alteradas. Nunca publica nada. */
  async detectar(): Promise<{ vistas: number; novas: number; reavaliadas: number }> {
    const agora = this.now();
    const settings = this.getSettings();
    const janela = janelaDeDeteccao(agora, settings.dataCorte);
    let vistas = 0, novas = 0, reavaliadas = 0;

    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const resp = await this.deps.ca.buscarContasReceber({ ...janela, pagina, tamanho_pagina: TAMANHO_PAGINA });
      const { itens, total } = itensDaBusca(resp);
      for (const item of itens) {
        vistas++;
        const existente = this.deps.db.getParcela(item.id);
        if (existente?.status === "SINCRONIZADO" || existente?.status === "ERRO") continue;
        if (existente && existente.alterado_em_ca === (item.data_alteracao ?? "") ) continue; // nada mudou na CA
        try {
          await this.registrarParcela(item, existente, agora);
          if (existente) reavaliadas++; else novas++;
        } catch (err) {
          // Um item problematico nao pode derrubar a janela inteira.
          log.error("falha ao registrar parcela; segue para a proxima", { idParcela: item.id, err: String(err) });
        }
      }
      if (itens.length < TAMANHO_PAGINA || pagina * TAMANHO_PAGINA >= total) break;
    }
    log.info("deteccao concluida", { vistas, novas, reavaliadas, janela });
    return { vistas, novas, reavaliadas };
  }

  private async registrarParcela(item: ItemBusca, existente: ParcelaRow | undefined, agora: Date): Promise<void> {
    const ts = agora.toISOString();
    // Se o detalhe falhar, o erro sobe e o item fica para a proxima janela.
    const detalhe = (await this.deps.ca.detalheParcela(item.id)) as ParcelaDetalhe;
    const elegib = avaliarElegibilidade(detalhe);
    const base = {
      cliente_nome: item.cliente?.nome ?? "(sem nome)",
      valor: Number(item.total ?? item.nao_pago ?? detalhe.nao_pago ?? 0),
      vencimento: (item.data_vencimento ?? detalhe.data_vencimento ?? "").slice(0, 10),
      emitido_em: item.data_criacao ?? ts,
      alterado_em_ca: item.data_alteracao ?? "",
      venda_uuid: detalhe.evento?.referencia?.id ?? null,
      venda_numero: numeroVenda(detalhe, item),
    };

    if (!elegib.elegivel) {
      // Sem boleto: guardamos como IGNORADO para nao reconsultar toda janela; se a
      // CA alterar a parcela (ex.: emitir o boleto depois), ela e reavaliada.
      if (existente) {
        this.deps.db.atualizarParcela(item.id, { ...base, status: "IGNORADO", motivo: elegib.motivo }, ts);
      } else {
        this.deps.db.inserirParcela({
          id_parcela: item.id, id_cobranca: null, documento: null, status: "IGNORADO", motivo: elegib.motivo,
          tentativas: 0, proxima_tentativa: null, documento_zen_id: null, arquivo_zen_id: null, cliente_zen_id: null,
          sincronizado_em: null, ...base,
        }, ts);
      }
      return;
    }

    const cobranca = elegib.cobranca;
    // Um boleto pode cobrir varias parcelas: a primeira parcela vista e a "dona";
    // as demais ficam IGNORADAS apontando para ela, e o PDF sobe uma vez so.
    const dona = this.deps.db.donaDaCobranca(cobranca.id, item.id);
    if (dona) {
      const motivo = `mesmo boleto da parcela ${dona.id_parcela} (venda ${dona.venda_numero ?? "?"})`;
      if (existente) this.deps.db.atualizarParcela(item.id, { ...base, status: "IGNORADO", motivo }, ts);
      else this.deps.db.inserirParcela({
        id_parcela: item.id, id_cobranca: null, documento: null, status: "IGNORADO", motivo, tentativas: 0, proxima_tentativa: null,
        documento_zen_id: null, arquivo_zen_id: null, cliente_zen_id: null, sincronizado_em: null, ...base,
      }, ts);
      return;
    }
    const patch = {
      ...base,
      id_cobranca: cobranca.id,
      valor: Number(cobranca.valor_composicao?.valor_liquido ?? base.valor),
      vencimento: (cobranca.data_vencimento ?? base.vencimento).slice(0, 10),
      emitido_em: dataEmissaoBoleto(cobranca, item, ts),
    };
    if (existente) {
      // Se ja estava pendente/quarentena, so atualiza os dados; nao zera tentativas.
      const status = existente.status === "IGNORADO" ? "REGISTRADO" : existente.status;
      this.deps.db.atualizarParcela(item.id, { ...patch, status, motivo: status === "REGISTRADO" ? null : existente.motivo }, ts);
      if (status === "REGISTRADO") this.deps.db.registrarEvento(item.id, "REGISTRADO", `Boleto registrado na Conta Azul (cobranca ${cobranca.id}). Aguardando publicacao.`, ts);
      return;
    }
    this.deps.db.inserirParcela({
      id_parcela: item.id, documento: null, status: "REGISTRADO", motivo: null, tentativas: 0, proxima_tentativa: null,
      documento_zen_id: null, arquivo_zen_id: null, cliente_zen_id: null, sincronizado_em: null, ...patch,
    }, ts);
    this.deps.db.registrarEvento(item.id, "REGISTRADO", `Boleto registrado na Conta Azul (cobranca ${cobranca.id}). Aguardando publicacao.`, ts);
  }

  // ------------------------------------------------------------------ entregar

  /**
   * Publica as parcelas prontas. `manual=true` e o botao "Ativar" (ignora o
   * horario e o autoRun, mas NAO a chave geral nem a data de corte).
   */
  async entregar(opts: { manual: boolean }): Promise<RunResult> {
    const settings = this.getSettings();
    if (!settings.envioHabilitado) throw new SyncError("ENVIO_DESABILITADO", "O envio ao Zen esta desabilitado. Nenhum documento foi publicado.");
    if (!settings.dataCorte) throw new SyncError("SEM_DATA_CORTE", "Defina a data de corte antes de publicar.");
    if (!opts.manual && !settings.autoRun) throw new SyncError("ENVIO_DESABILITADO", "Modo automatico desligado.");
    const agora = this.now();
    if (!opts.manual && !dentroDoHorarioDeEntrega(agora)) throw new SyncError("FORA_DO_HORARIO", "Fora do horario de entrega (7h-19h).");
    if (this.running) throw new SyncError("EXECUCAO_EM_ANDAMENTO", "Ja existe uma execucao em andamento.");

    this.running = true;
    try {
      const prontas = this.deps.db.listarProntas(agora.toISOString(), `${settings.dataCorte}T00:00:00`, settings.limitePorRodada);
      const itens: RunItem[] = [];
      for (const row of prontas) itens.push(await this.publicarUma(row));
      const subiram = itens.filter((i) => i.ok);
      const result: RunResult = {
        executadoEm: agora.toISOString(),
        total: itens.length,
        subiram: subiram.length,
        naoSubiram: itens.length - subiram.length,
        valorPublicado: subiram.reduce((acc, i) => acc + i.boleto.valor, 0),
        itens,
      };
      this.deps.db.setConfig("lastRun", result);
      log.info("rodada de entrega concluida", { manual: opts.manual, total: result.total, subiram: result.subiram, naoSubiram: result.naoSubiram });
      return result;
    } finally {
      this.running = false;
    }
  }

  private async publicarUma(inicial: ParcelaRow): Promise<RunItem> {
    const ts = this.now().toISOString();
    // Releitura: protege contra corrida com outra rodada/instancia.
    const row = this.deps.db.getParcela(inicial.id_parcela) ?? inicial;
    if (row.status === "SINCRONIZADO" || !row.id_cobranca) {
      return { boleto: paraBoleto(row), ok: true, mensagem: "Ja publicado anteriormente." };
    }
    try {
      // 1) CPF/CNPJ do cliente (via venda), se ainda nao temos.
      let documento = row.documento;
      let clienteNome = row.cliente_nome;
      if (!documento) {
        if (!row.venda_uuid) throw new Error("parcela sem venda de origem; nao ha como obter o CPF/CNPJ");
        const venda = (await this.deps.ca.detalheVenda(row.venda_uuid)) as VendaDetalhe;
        documento = (venda.cliente?.documento ?? "").replace(/\D/g, "");
        clienteNome = venda.cliente?.nome ?? clienteNome;
        if (!documento) throw new Error("venda sem CPF/CNPJ do cliente");
        this.deps.db.atualizarParcela(row.id_parcela, { documento, cliente_nome: clienteNome }, ts);
      }
      // 2) Cobranca ainda registrada?
      const cob = (await this.deps.ca.statusCobranca(row.id_cobranca)) as { status?: string };
      if (cob.status !== "REGISTRADO") throw new Error(`cobranca com status ${cob.status ?? "desconhecido"}`);
      // 3) PDF + publicacao.
      const pdf = await this.deps.ca.baixarPdfBoleto(row.id_cobranca);
      const zen = this.deps.zen();
      const result = await zen.publishBoleto({
        documento,
        pdf,
        fileName: nomeArquivo(row.venda_numero, row.id_cobranca),
        title: tituloDocumento(row.venda_numero, row.vencimento),
        dueDate: row.vencimento,
        amount: row.valor,
      });
      const fim = this.now().toISOString();
      const atualizado = this.deps.db.atualizarParcela(row.id_parcela, {
        status: "SINCRONIZADO", motivo: null, documento_zen_id: result.documentId, arquivo_zen_id: result.fileId,
        cliente_zen_id: result.clientId, sincronizado_em: fim, proxima_tentativa: null,
      }, fim);
      const mensagem = `Boleto publicado no Zen (documento ${result.documentId}) para ${clienteNome}.`;
      this.deps.db.registrarEvento(row.id_parcela, "SINCRONIZADO", mensagem, fim);
      return { boleto: paraBoleto(atualizado), ok: true, mensagem };
    } catch (err) {
      return this.registrarFalha(row, err);
    }
  }

  private async registrarFalha(row: ParcelaRow, err: unknown): Promise<RunItem> {
    const agora = this.now();
    const ts = agora.toISOString();
    const falhas = row.tentativas + 1;
    const proxima = agendarProximaTentativa(falhas, agora);
    const motivo = err instanceof Error ? err.message : String(err);
    const status = proxima ? "QUARENTENA" : "ERRO";
    const atualizado = this.deps.db.atualizarParcela(row.id_parcela, {
      status, motivo, tentativas: falhas, proxima_tentativa: proxima ? proxima.toISOString() : null,
    }, ts);
    const mensagem = proxima
      ? `${motivo} Nova tentativa em ${proxima.toLocaleString("pt-BR", { timeZone: FUSO })} (falha ${falhas} de ${MAX_FALHAS}).`
      : `${motivo} Falha definitiva apos ${falhas} tentativas.`;
    this.deps.db.registrarEvento(row.id_parcela, status, mensagem, ts);
    log.warn("falha ao publicar boleto", { idParcela: row.id_parcela, falhas, status, motivo });

    if (status === "ERRO") {
      await this.alert(`falha-definitiva-${row.id_parcela}`, `Boleto ${row.venda_numero ?? row.id_parcela} nao pode ser entregue`,
        `cliente=${row.cliente_nome} documento=${row.documento ?? "?"} valor=${row.valor} vencimento=${row.vencimento} motivo=${motivo}`);
    }
    // Zen instavel: 5+ falhas em 10 minutos.
    const dezMinAtras = new Date(agora.getTime() - 10 * 60_000).toISOString();
    if (this.deps.db.contarFalhasDesde(dezMinAtras) >= 5) {
      await this.alert("zen-instavel", "Muitas falhas seguidas ao publicar no Zen", "5 ou mais falhas nos ultimos 10 minutos.");
    }
    return { boleto: paraBoleto(atualizado), ok: false, mensagem };
  }

  // -------------------------------------------------------------------- ciclo

  /** Uma janela do agendador: detecta sempre; entrega so se as regras permitirem. */
  async ciclo(): Promise<void> {
    try {
      await this.detectar();
    } catch (err) {
      log.error("falha na deteccao", { err: String(err) });
      await this.alert("ca-sync-fail", "Falha ao consultar a Conta Azul na janela de sync", String(err));
      return;
    }
    try {
      await this.entregar({ manual: false });
    } catch (err) {
      if (err instanceof SyncError) {
        log.info("entrega nao executada nesta janela", { motivo: err.code });
        return;
      }
      log.error("falha na entrega automatica", { err: String(err) });
      await this.alert("entrega-fail", "Falha na rodada automatica de entrega", String(err));
    }
  }
}

// ------------------------------------------------------------------ helpers

function itensDaBusca(resp: unknown): { itens: ItemBusca[]; total: number } {
  if (Array.isArray(resp)) return { itens: resp as ItemBusca[], total: resp.length };
  const r = resp as { itens?: ItemBusca[]; itens_totais?: number };
  const itens = Array.isArray(r?.itens) ? r.itens : [];
  return { itens, total: Number(r?.itens_totais ?? itens.length) };
}

function numeroVenda(detalhe: ParcelaDetalhe, item: ItemBusca): number | null {
  const ref = detalhe.evento?.codigo_referencia;
  if (ref && /^\d+$/.test(ref)) return Number(ref);
  const m = /Venda\s+(\d+)/i.exec(item.descricao ?? detalhe.descricao ?? "");
  return m ? Number(m[1]) : null;
}

/** Converte a linha do banco para o contrato do painel. */
export function paraBoleto(row: ParcelaRow): Boleto {
  return {
    idCobranca: row.id_cobranca ?? row.id_parcela,
    idParcela: row.id_parcela,
    vendaId: row.venda_numero ?? 0,
    cliente: row.cliente_nome,
    cnpj: row.documento ?? "",
    valor: row.valor,
    vencimento: row.vencimento,
    status: row.status === "IGNORADO" ? "REGISTRADO" : row.status,
    empresaZen: row.cliente_zen_id ? row.cliente_nome : null,
    documentoZenId: row.documento_zen_id,
    emitidoEm: row.emitido_em,
    sincronizadoEm: row.sincronizado_em,
  };
}
