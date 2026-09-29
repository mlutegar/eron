import { describe, expect, it } from "vitest";
import {
  MAX_FALHAS, agendarProximaTentativa, avaliarElegibilidade, dataHoraEmBrasilia, dentroDoHorarioDeEntrega,
  janelaDeDeteccao, nomeArquivo, tituloDocumento,
} from "./regras.js";

const H = 3_600_000;
const D = 24 * H;

describe("tentativas (escopo: 1h, 6h, 1d, 3d, 7d, 30d; 7a = definitiva)", () => {
  const agora = new Date("2026-10-01T12:00:00Z");
  it("agenda os intervalos crescentes", () => {
    expect(agendarProximaTentativa(1, agora)!.getTime() - agora.getTime()).toBe(1 * H);
    expect(agendarProximaTentativa(2, agora)!.getTime() - agora.getTime()).toBe(6 * H);
    expect(agendarProximaTentativa(3, agora)!.getTime() - agora.getTime()).toBe(1 * D);
    expect(agendarProximaTentativa(4, agora)!.getTime() - agora.getTime()).toBe(3 * D);
    expect(agendarProximaTentativa(5, agora)!.getTime() - agora.getTime()).toBe(7 * D);
    expect(agendarProximaTentativa(6, agora)!.getTime() - agora.getTime()).toBe(30 * D);
  });
  it("na 7a falha nao agenda mais (falha definitiva)", () => {
    expect(MAX_FALHAS).toBe(7);
    expect(agendarProximaTentativa(7, agora)).toBeNull();
    expect(agendarProximaTentativa(12, agora)).toBeNull();
  });
});

describe("horario de entrega (7h-19h Brasilia)", () => {
  it("06:59 nao, 07:00 sim, 18:59 sim, 19:00 nao", () => {
    // Brasilia = UTC-3
    expect(dentroDoHorarioDeEntrega(new Date("2026-10-01T09:59:00Z"))).toBe(false);
    expect(dentroDoHorarioDeEntrega(new Date("2026-10-01T10:00:00Z"))).toBe(true);
    expect(dentroDoHorarioDeEntrega(new Date("2026-10-01T21:59:00Z"))).toBe(true);
    expect(dentroDoHorarioDeEntrega(new Date("2026-10-01T22:00:00Z"))).toBe(false);
  });
  it("formata data-hora no fuso de Brasilia", () => {
    expect(dataHoraEmBrasilia(new Date("2026-10-01T03:05:09Z"))).toBe("2026-10-01T00:05:09");
  });
});

describe("janela de deteccao", () => {
  const agora = new Date("2026-10-11T15:00:00Z"); // 12:00 em Brasilia
  it("sem data de corte: 10 dias para tras", () => {
    const j = janelaDeDeteccao(agora, null);
    expect(j.data_alteracao_de).toBe("2026-10-01T12:00:00");
    expect(j.data_alteracao_ate).toBe("2026-10-11T12:00:00");
    expect(j.data_vencimento_de < j.data_vencimento_ate).toBe(true);
  });
  it("data de corte mais recente que 10 dias limita a janela", () => {
    const j = janelaDeDeteccao(agora, "2026-10-05");
    expect(j.data_alteracao_de).toBe("2026-10-05T00:00:00");
  });
  it("data de corte antiga nao alarga a janela alem de 10 dias", () => {
    const j = janelaDeDeteccao(agora, "2026-01-01");
    expect(j.data_alteracao_de).toBe("2026-10-01T12:00:00");
  });
});

describe("elegibilidade da parcela", () => {
  const cobranca = { id: "cob-1", tipo_solicitacao_cobranca: "BOLETO", status_solicitacao_cobranca: "REGISTRADO" };
  it("boleto bancario pendente com 1 boleto registrado e elegivel", () => {
    const r = avaliarElegibilidade({ id: "p", status: "PENDENTE", metodo_pagamento: "BOLETO_BANCARIO", solicitacoes_cobrancas: [cobranca] });
    expect(r).toEqual({ elegivel: true, cobranca });
  });
  it("pix, parcela paga, sem boleto ou com 2 boletos nao sao elegiveis", () => {
    expect(avaliarElegibilidade({ id: "p", metodo_pagamento: "PIX", solicitacoes_cobrancas: [cobranca] }).elegivel).toBe(false);
    expect(avaliarElegibilidade({ id: "p", status: "PAGO", metodo_pagamento: "BOLETO_BANCARIO", solicitacoes_cobrancas: [cobranca] }).elegivel).toBe(false);
    expect(avaliarElegibilidade({ id: "p", status: "PENDENTE", metodo_pagamento: "BOLETO_BANCARIO", solicitacoes_cobrancas: [] }).elegivel).toBe(false);
    expect(avaliarElegibilidade({ id: "p", status: "PENDENTE", metodo_pagamento: "BOLETO_BANCARIO", solicitacoes_cobrancas: [cobranca, { ...cobranca, id: "cob-2" }] }).elegivel).toBe(false);
  });
  it("boleto cancelado nao conta", () => {
    const r = avaliarElegibilidade({ id: "p", status: "PENDENTE", metodo_pagamento: "BOLETO_BANCARIO",
      solicitacoes_cobrancas: [{ ...cobranca, status_solicitacao_cobranca: "CANCELADO" }] });
    expect(r.elegivel).toBe(false);
  });
});

describe("titulo e nome do arquivo", () => {
  it("segue o padrao validado na homologacao", () => {
    expect(tituloDocumento(2246, "2026-10-02")).toBe("Boleto Venda 2246 - venc. 02/10/2026");
    expect(nomeArquivo(2246, "0f3ef416-bc3e")).toBe("boleto-venda-2246.pdf");
    expect(nomeArquivo(null, "0f3ef416-bc3e")).toBe("boleto-0f3ef416.pdf");
  });
});
