// Regras de negocio do robo, todas puras (sem rede, sem banco) para serem
// testadas com facilidade. Seguem o escopo do robo anterior:
//   - deteccao 24h, entrega no Zen so das 7h as 19h (Brasilia)
//   - janela de 10 dias, limitada pela data de corte
//   - novas tentativas em 1h, 6h, 1d, 3d, 7d, 30d; na 7a falha vira definitiva

const HORA = 3_600_000;
const DIA = 24 * HORA;

export const INTERVALOS_TENTATIVA_MS = [1 * HORA, 6 * HORA, 1 * DIA, 3 * DIA, 7 * DIA, 30 * DIA];
/** Numero de falhas a partir do qual o boleto e marcado como falha definitiva. */
export const MAX_FALHAS = INTERVALOS_TENTATIVA_MS.length + 1; // 7

export const FUSO = "America/Sao_Paulo";
export const HORARIO_ENTREGA = { inicio: 7, fim: 19 }; // [7h, 19h)
export const JANELA_DETECCAO_DIAS = 10;

/**
 * Dado o total de falhas ja ocorridas (incluindo a atual), devolve quando tentar
 * de novo, ou `null` se esgotou (falha definitiva).
 */
export function agendarProximaTentativa(falhas: number, agora: Date): Date | null {
  if (falhas >= MAX_FALHAS) return null;
  const intervalo = INTERVALOS_TENTATIVA_MS[Math.max(0, falhas - 1)];
  return new Date(agora.getTime() + intervalo);
}

/** Partes de data/hora no fuso de Brasilia. */
export function partesEmBrasilia(d: Date): { ano: number; mes: number; dia: number; hora: number; minuto: number; segundo: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, minuto: +p.minute, segundo: +p.second };
}

/** "AAAA-MM-DD" em Brasilia. */
export function dataEmBrasilia(d: Date): string {
  const { ano, mes, dia } = partesEmBrasilia(d);
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** "AAAA-MM-DDTHH:mm:ss" em Brasilia — formato que a CA usa nos filtros de data-hora. */
export function dataHoraEmBrasilia(d: Date): string {
  const { hora, minuto, segundo } = partesEmBrasilia(d);
  return `${dataEmBrasilia(d)}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:${String(segundo).padStart(2, "0")}`;
}

export function dentroDoHorarioDeEntrega(d: Date): boolean {
  const { hora } = partesEmBrasilia(d);
  return hora >= HORARIO_ENTREGA.inicio && hora < HORARIO_ENTREGA.fim;
}

export interface JanelaDeteccao {
  data_alteracao_de: string;
  data_alteracao_ate: string;
  data_vencimento_de: string;
  data_vencimento_ate: string;
}

/**
 * Janela da busca na CA: parcelas alteradas nos ultimos N dias (nunca antes da
 * data de corte). `data_vencimento_*` e obrigatorio na API; usamos uma faixa larga.
 */
export function janelaDeDeteccao(agora: Date, dataCorte: string | null, dias = JANELA_DETECCAO_DIAS): JanelaDeteccao {
  let inicio = new Date(agora.getTime() - dias * DIA);
  if (dataCorte) {
    const corte = new Date(`${dataCorte}T00:00:00-03:00`);
    if (corte.getTime() > inicio.getTime()) inicio = corte;
  }
  return {
    data_alteracao_de: dataHoraEmBrasilia(inicio),
    data_alteracao_ate: dataHoraEmBrasilia(agora),
    data_vencimento_de: dataEmBrasilia(new Date(agora.getTime() - 60 * DIA)),
    data_vencimento_ate: dataEmBrasilia(new Date(agora.getTime() + 730 * DIA)),
  };
}

// --- Elegibilidade de uma parcela (formato observado em GET /parcelas/{id}) ---

export interface SolicitacaoCobranca {
  id: string;
  tipo_solicitacao_cobranca?: string;
  status_solicitacao_cobranca?: string;
  data_vencimento?: string;
  valor_composicao?: { valor_liquido?: number };
  /** Presente quando a CA notificou o cliente — a data e a melhor pista da emissao do boleto. */
  notificao_cobranca?: { enviado_em?: string | null } | null;
}

/**
 * Quando o boleto foi emitido. A CA nao expoe a data de criacao da cobranca; usamos
 * a data em que ela notificou o cliente e, na falta, a ultima alteracao da parcela.
 * (A criacao da parcela nao serve: contratos recorrentes criam parcelas meses antes.)
 */
export function dataEmissaoBoleto(cobranca: SolicitacaoCobranca, parcela: { data_alteracao?: string; data_criacao?: string }, fallback: string): string {
  const enviado = cobranca.notificao_cobranca?.enviado_em;
  if (enviado && /^\d{4}-\d{2}-\d{2}/.test(enviado)) return enviado.length === 10 ? `${enviado}T00:00:00` : enviado;
  return parcela.data_alteracao ?? parcela.data_criacao ?? fallback;
}

export interface ParcelaDetalhe {
  id: string;
  status?: string; // PENDENTE, PAGO...
  metodo_pagamento?: string;
  data_vencimento?: string;
  nao_pago?: number;
  descricao?: string;
  evento?: { codigo_referencia?: string; referencia?: { id?: string; origem?: string } };
  solicitacoes_cobrancas?: SolicitacaoCobranca[];
}

export type Elegibilidade =
  | { elegivel: true; cobranca: SolicitacaoCobranca }
  | { elegivel: false; motivo: string };

export function avaliarElegibilidade(p: ParcelaDetalhe): Elegibilidade {
  if (p.metodo_pagamento !== "BOLETO_BANCARIO") return { elegivel: false, motivo: `metodo de pagamento ${p.metodo_pagamento ?? "desconhecido"}` };
  if (p.status && p.status !== "PENDENTE") return { elegivel: false, motivo: `parcela ${p.status}` };
  const boletos = (p.solicitacoes_cobrancas ?? []).filter(
    (c) => c.tipo_solicitacao_cobranca === "BOLETO" && c.status_solicitacao_cobranca === "REGISTRADO",
  );
  if (boletos.length === 0) return { elegivel: false, motivo: "sem boleto registrado" };
  if (boletos.length > 1) return { elegivel: false, motivo: "mais de um boleto registrado" };
  return { elegivel: true, cobranca: boletos[0] };
}

export function formatarDataBR(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function tituloDocumento(numeroVenda: number | string | null, vencimento: string): string {
  const venda = numeroVenda ? `Venda ${numeroVenda}` : "Venda";
  return `Boleto ${venda} - venc. ${formatarDataBR(vencimento)}`;
}

export function nomeArquivo(numeroVenda: number | string | null, idCobranca: string): string {
  const base = numeroVenda ? `boleto-venda-${numeroVenda}` : `boleto-${idCobranca.slice(0, 8)}`;
  return `${base}.pdf`;
}
