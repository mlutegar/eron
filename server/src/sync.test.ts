// Testes do motor com Conta Azul e Zen simulados e SQLite em memoria.
// Nenhuma chamada de rede acontece aqui.
import { describe, expect, it } from "vitest";
import { Db } from "./db.js";
import { SyncEngine, SyncError, type CaPort, type ZenPort } from "./sync.js";
import { createStore } from "./store.js";
import { OverviewSchema, RunResultSchema } from "./types.js";

const PDF = new TextEncoder().encode("%PDF-1.7\nteste");

function parcelaCA(id: string, opts: { boleto?: boolean; alteracao?: string; venda?: number; cobranca?: string; enviadoEm?: string } = {}) {
  const boleto = opts.boleto ?? true;
  return {
    item: {
      id, descricao: `Venda ${opts.venda ?? 100}`, total: 100, data_vencimento: "2026-10-20",
      data_criacao: "2026-10-01T10:00:00", data_alteracao: opts.alteracao ?? "2026-10-01T10:00:05",
      status_traduzido: "EM_ABERTO", cliente: { id: "cli-1", nome: "Cliente Teste" },
    },
    detalhe: {
      id, status: "PENDENTE", metodo_pagamento: boleto ? "BOLETO_BANCARIO" : "PIX", data_vencimento: "2026-10-20",
      evento: { codigo_referencia: String(opts.venda ?? 100), referencia: { id: `venda-${id}`, origem: "VENDA" } },
      solicitacoes_cobrancas: boleto
        ? [{ id: opts.cobranca ?? `cob-${id}`, tipo_solicitacao_cobranca: "BOLETO", status_solicitacao_cobranca: "REGISTRADO", data_vencimento: "2026-10-20",
            valor_composicao: { valor_liquido: 100 }, notificao_cobranca: opts.enviadoEm ? { enviado_em: opts.enviadoEm } : null }]
        : [],
    },
  };
}

function fakeCa(parcelas: ReturnType<typeof parcelaCA>[]): CaPort & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    async buscarContasReceber(q) {
      chamadas.push(`buscar p${q.pagina}`);
      return { itens_totais: parcelas.length, itens: parcelas.map((p) => p.item) };
    },
    async detalheParcela(id) {
      chamadas.push(`parcela ${id}`);
      return parcelas.find((p) => p.item.id === id)!.detalhe;
    },
    async detalheVenda(id) {
      chamadas.push(`venda ${id}`);
      // venda-pj simula pessoa juridica: a CA devolve documento null na venda.
      if (id.endsWith("-pj")) return { cliente: { uuid: "pessoa-pj", nome: "Empresa PJ LTDA", documento: null, tipo_pessoa: "Jurídica" }, venda: { id, numero: 200 } };
      return { cliente: { uuid: "pessoa-pf", nome: "Cliente Teste", documento: "413.239.838-21" }, venda: { id, numero: 100 } };
    },
    async detalhePessoa(id) {
      chamadas.push(`pessoa ${id}`);
      return id === "pessoa-pj" ? { nome: "Empresa PJ LTDA", documento: "31966936000103" } : { nome: "Cliente Teste", documento: "41323983821" };
    },
    async statusCobranca(id) {
      chamadas.push(`cobranca ${id}`);
      return { id, status: "REGISTRADO", url: "https://faturas.contaazul.com/#/x" };
    },
    async baixarPdfBoleto(id) {
      chamadas.push(`pdf ${id}`);
      return PDF;
    },
  };
}

function fakeZen(fail?: (n: number) => Error | null): ZenPort & { publicados: string[] } {
  let n = 0;
  const publicados: string[] = [];
  return {
    publicados,
    async publishBoleto(input) {
      n++;
      const err = fail?.(n);
      if (err) throw err;
      publicados.push(input.fileName);
      return { documentId: `doc-${n}`, fileId: `arq-${n}`, clientId: "cli-zen", categoryId: "cat" };
    },
  };
}

// 2026-10-05 15:00 UTC = 12:00 Brasilia (dentro do horario de entrega)
const AGORA = new Date("2026-10-05T15:00:00Z");

function engineCom(parcelas: ReturnType<typeof parcelaCA>[], zen = fakeZen(), now = () => AGORA) {
  const db = Db.open(":memory:");
  const ca = fakeCa(parcelas);
  const alertas: string[] = [];
  const engine = new SyncEngine({ ca, zen: () => zen, db, now, alert: async (k) => { alertas.push(k); } });
  return { db, ca, zen, engine, alertas };
}

describe("SyncEngine — deteccao", () => {
  it("registra so parcelas com boleto; as demais ficam IGNORADAS e nao sao reconsultadas", async () => {
    const { engine, db, ca } = engineCom([parcelaCA("p1"), parcelaCA("p2", { boleto: false })]);
    const r1 = await engine.detectar();
    expect(r1).toMatchObject({ vistas: 2, novas: 2 });
    expect(db.getParcela("p1")?.status).toBe("REGISTRADO");
    expect(db.getParcela("p1")?.id_cobranca).toBe("cob-p1");
    expect(db.getParcela("p2")?.status).toBe("IGNORADO");

    const antes = ca.chamadas.length;
    const r2 = await engine.detectar();
    expect(r2).toMatchObject({ novas: 0, reavaliadas: 0 });
    expect(ca.chamadas.slice(antes).filter((c) => c.startsWith("parcela"))).toHaveLength(0);
  });

  it("reavalia parcela IGNORADA quando a CA a altera (boleto emitido depois)", async () => {
    const p2 = parcelaCA("p2", { boleto: false });
    const { engine, db } = engineCom([p2]);
    await engine.detectar();
    expect(db.getParcela("p2")?.status).toBe("IGNORADO");
    // CA altera a parcela e agora ha boleto
    const comBoleto = parcelaCA("p2", { boleto: true, alteracao: "2026-10-02T09:00:00" });
    Object.assign(p2.item, comBoleto.item);
    Object.assign(p2.detalhe, comBoleto.detalhe);
    const r = await engine.detectar();
    expect(r.reavaliadas).toBe(1);
    expect(db.getParcela("p2")?.status).toBe("REGISTRADO");
  });

  it("boleto compartilhado por duas parcelas e publicado uma vez so", async () => {
    const { engine, db, zen } = engineCom([parcelaCA("p1", { cobranca: "cob-x" }), parcelaCA("p2", { cobranca: "cob-x" })]);
    await engine.detectar();
    expect(db.getParcela("p1")?.status).toBe("REGISTRADO");
    expect(db.getParcela("p2")?.status).toBe("IGNORADO");
    expect(db.getParcela("p2")?.motivo).toContain("mesmo boleto da parcela p1");
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    const r = await engine.entregar({ manual: true });
    expect(r.total).toBe(1);
    expect(zen.publicados).toHaveLength(1);
  });

  it("um item problematico nao derruba a deteccao", async () => {
    const ruim = parcelaCA("ruim");
    const { engine, db, ca } = engineCom([ruim, parcelaCA("bom")]);
    const original = ca.detalheParcela.bind(ca);
    ca.detalheParcela = async (id) => { if (id === "ruim") throw new Error("HTTP 500"); return original(id); };
    const r = await engine.detectar();
    expect(r.novas).toBe(1);
    expect(db.getParcela("bom")?.status).toBe("REGISTRADO");
    expect(db.getParcela("ruim")).toBeUndefined();
  });

  it("data de emissao do boleto vem da notificacao da CA, nao da criacao da parcela", async () => {
    const antiga = parcelaCA("contrato", { enviadoEm: "2026-10-03" });
    antiga.item.data_criacao = "2026-05-15T16:41:23";
    const { engine, db } = engineCom([antiga]);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-10-01" });
    await engine.detectar();
    expect(db.getParcela("contrato")?.emitido_em).toBe("2026-10-03T00:00:00");
    const r = await engine.entregar({ manual: true });
    expect(r.subiram).toBe(1); // entrou apesar da parcela ser de maio
  });

  it("pessoa juridica: CNPJ vem do cadastro da pessoa quando a venda nao traz", async () => {
    const { engine, db, ca } = engineCom([parcelaCA("emp-pj")]);
    await engine.detectar();
    expect(db.getParcela("emp-pj")?.documento).toBe("31966936000103");
    expect(db.getParcela("emp-pj")?.cliente_nome).toBe("Empresa PJ LTDA");
    expect(ca.chamadas).toContain("pessoa pessoa-pj");
  });

  it("deteccao nunca publica nada", async () => {
    const { engine, zen } = engineCom([parcelaCA("p1")]);
    await engine.detectar();
    await engine.ciclo(); // envio desabilitado por padrao
    expect(zen.publicados).toHaveLength(0);
  });
});

describe("SyncEngine — travas de entrega", () => {
  it("por padrao o envio esta desabilitado, manual ou automatico", async () => {
    const { engine } = engineCom([parcelaCA("p1")]);
    await engine.detectar();
    await expect(engine.entregar({ manual: true })).rejects.toMatchObject({ code: "ENVIO_DESABILITADO" });
    await expect(engine.entregar({ manual: false })).rejects.toMatchObject({ code: "ENVIO_DESABILITADO" });
  });

  it("sem Zen configurado a rodada e recusada antes de comecar, mesmo com tudo ligado", async () => {
    const db = Db.open(":memory:");
    const engine = new SyncEngine({ ca: fakeCa([parcelaCA("p1")]), zen: () => { throw new Error("ZEN_API_TOKEN ausente"); }, db, now: () => AGORA });
    engine.setSettings({ envioHabilitado: true, autoRun: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    await expect(engine.entregar({ manual: true })).rejects.toMatchObject({ code: "ZEN_NAO_CONFIGURADO" });
    expect(db.getParcela("p1")?.status).toBe("REGISTRADO"); // nada virou falha
  });

  it("data de corte: rejeita formato invalido e recuo com o envio ligado", () => {
    const { engine } = engineCom([]);
    expect(() => engine.setSettings({ dataCorte: "0002-10-01" })).toThrow(/invalida/);
    engine.setSettings({ dataCorte: "2026-10-01", envioHabilitado: true });
    expect(() => engine.setSettings({ dataCorte: "2026-09-20" })).toThrow(/desligue/);
    expect(engine.setSettings({ dataCorte: "2026-10-02" }).dataCorte).toBe("2026-10-02"); // avancar pode
    engine.setSettings({ envioHabilitado: false });
    expect(engine.setSettings({ dataCorte: "2026-09-20" }).dataCorte).toBe("2026-09-20"); // desligado pode recuar
  });

  it("habilitar o envio sem data de corte define a data de corte como hoje", () => {
    const { engine } = engineCom([]);
    const s = engine.setSettings({ envioHabilitado: true });
    expect(s.dataCorte).toBe("2026-10-05");
  });

  it("automatico exige autoRun e horario 7h-19h; manual ignora os dois", async () => {
    const madrugada = new Date("2026-10-05T05:00:00Z"); // 02:00 Brasilia
    const { engine, zen } = engineCom([parcelaCA("p1")], fakeZen(), () => madrugada);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    await expect(engine.entregar({ manual: false })).rejects.toMatchObject({ code: "ENVIO_DESABILITADO" });
    engine.setSettings({ autoRun: true });
    await expect(engine.entregar({ manual: false })).rejects.toMatchObject({ code: "FORA_DO_HORARIO" });
    const r = await engine.entregar({ manual: true });
    expect(r.subiram).toBe(1);
    expect(zen.publicados).toEqual(["boleto-venda-100.pdf"]);
  });

  it("respeita a data de corte e o limite por rodada", async () => {
    const antiga = parcelaCA("velha", { enviadoEm: "2026-09-20" }); // boleto emitido antes do corte
    const { engine, zen } = engineCom([antiga, parcelaCA("a"), parcelaCA("b"), parcelaCA("c")]);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-10-01", limitePorRodada: 2 });
    await engine.detectar();
    const r1 = await engine.entregar({ manual: true });
    expect(r1.total).toBe(2);
    const r2 = await engine.entregar({ manual: true });
    expect(r2.total).toBe(1);
    const r3 = await engine.entregar({ manual: true });
    expect(r3.total).toBe(0); // a "velha" (antes do corte) nunca entra
    expect(zen.publicados).toHaveLength(3);
  });
});

describe("SyncEngine — publicacao, idempotencia e falhas", () => {
  it("publica com CPF/CNPJ obtido da venda e nunca repete o mesmo boleto", async () => {
    const { engine, db, zen, ca } = engineCom([parcelaCA("p1")]);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    const r = await engine.entregar({ manual: true });
    expect(RunResultSchema.safeParse(r).success).toBe(true);
    expect(r.subiram).toBe(1);
    expect(r.valorPublicado).toBe(100);
    const row = db.getParcela("p1")!;
    expect(row.status).toBe("SINCRONIZADO");
    expect(row.documento).toBe("41323983821");
    expect(row.documento_zen_id).toBe("doc-1");
    expect(ca.chamadas).toContain("venda venda-p1");

    // Nova deteccao + nova rodada: nada e reenviado.
    await engine.detectar();
    const r2 = await engine.entregar({ manual: true });
    expect(r2.total).toBe(0);
    expect(zen.publicados).toHaveLength(1);
  });

  it("falha vai para QUARENTENA com nova tentativa em 1h; 7a falha vira ERRO e alerta", async () => {
    let relogio = AGORA;
    const zen = fakeZen(() => new Error("Zen respondeu HTTP 404 em GET clientes."));
    const { engine, db, alertas } = engineCom([parcelaCA("p1")], zen, () => relogio);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();

    const r1 = await engine.entregar({ manual: true });
    expect(r1.naoSubiram).toBe(1);
    let row = db.getParcela("p1")!;
    expect(row.status).toBe("QUARENTENA");
    expect(row.tentativas).toBe(1);
    expect(new Date(row.proxima_tentativa!).getTime() - AGORA.getTime()).toBe(3_600_000);

    // Antes da hora: nao tenta de novo.
    const r2 = await engine.entregar({ manual: true });
    expect(r2.total).toBe(0);

    // Avanca o relogio e esgota as tentativas.
    for (let i = 2; i <= 7; i++) {
      relogio = new Date(new Date(db.getParcela("p1")!.proxima_tentativa ?? relogio).getTime() + 1000);
      await engine.entregar({ manual: true });
    }
    row = db.getParcela("p1")!;
    expect(row.status).toBe("ERRO");
    expect(row.tentativas).toBe(7);
    expect(row.proxima_tentativa).toBeNull();
    expect(alertas).toContain("falha-definitiva-p1");
  });

  it("lock: nao roda duas rodadas ao mesmo tempo", async () => {
    let libera!: () => void;
    const zen: ZenPort = { publishBoleto: () => new Promise((res) => { libera = () => res({ documentId: "d", fileId: "f", clientId: "c", categoryId: "k" }); }) };
    const { engine } = engineCom([parcelaCA("p1")], zen as ZenPort & { publicados: string[] });
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    const primeira = engine.entregar({ manual: true });
    await new Promise((r) => setTimeout(r, 10));
    await expect(engine.entregar({ manual: true })).rejects.toBeInstanceOf(SyncError);
    libera();
    expect((await primeira).subiram).toBe(1);
  });
});

describe("store (painel) sobre o banco", () => {
  it("overview segue o contrato e reflete o que foi publicado", async () => {
    const { engine, db } = engineCom([parcelaCA("p1"), parcelaCA("p2")]);
    const store = createStore(db, engine, 10);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    expect(store.getPending()).toHaveLength(2);
    await engine.entregar({ manual: true });
    const ov = store.getOverview();
    expect(OverviewSchema.safeParse(ov).success).toBe(true);
    expect(store.getPending()).toHaveLength(0);
    expect(store.getSyncLogs().filter((l) => l.status === "SINCRONIZADO")).toHaveLength(2);
    expect(store.getClientMap()[0]).toMatchObject({ cnpj: "41323983821", situacao: "MAPEADO" });
  });

  it("pendentes do painel respeitam a data de corte", async () => {
    const antiga = parcelaCA("velha", { enviadoEm: "2026-09-20" });
    const nova = parcelaCA("nova", { enviadoEm: "2026-10-02" });
    const { engine, db } = engineCom([antiga, nova]);
    const store = createStore(db, engine, 10);
    await engine.detectar();
    expect(store.getPending()).toHaveLength(2); // sem data de corte: tudo
    engine.setSettings({ dataCorte: "2026-10-01" });
    expect(store.getPending().map((b) => b.idParcela)).toEqual(["nova"]);
  });

  it("reprocessar libera a parcela em quarentena para a proxima rodada", async () => {
    const zen = fakeZen((n) => (n === 1 ? new Error("timeout") : null));
    const { engine, db } = engineCom([parcelaCA("p1")], zen);
    const store = createStore(db, engine, 10);
    engine.setSettings({ envioHabilitado: true, dataCorte: "2026-09-30" });
    await engine.detectar();
    await engine.entregar({ manual: true });
    expect(store.getQuarantine()).toHaveLength(1);
    store.reprocess("p1");
    const r = await engine.entregar({ manual: true });
    expect(r.subiram).toBe(1);
    expect(store.getQuarantine()).toHaveLength(0);
  });

  it("settings vazios voltam ao padrao seguro (tudo desligado)", () => {
    const { engine } = engineCom([]);
    expect(engine.getSettings()).toMatchObject({ autoRun: false, envioHabilitado: false, dataCorte: null, limitePorRodada: 20 });
  });
});
