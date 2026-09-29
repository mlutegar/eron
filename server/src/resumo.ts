// Resumo diario (escopo: todo dia as 18h, horario de Brasilia): quantos boletos
// foram entregues no dia, quantos seguem pendentes e quais falharam de vez.
import type { Db } from "./db.js";
import { dataEmBrasilia, formatarDataBR, partesEmBrasilia } from "./regras.js";

export const HORA_RESUMO = 18;

export interface ResumoDiario {
  dia: string; // AAAA-MM-DD (Brasilia)
  entregues: number;
  valorEntregue: number;
  pendentes: number;
  emQuarentena: number;
  falhasDefinitivas: Array<{ venda: number | null; cliente: string; documento: string | null; valor: number; vencimento: string; motivo: string | null }>;
  envioHabilitado: boolean;
  autoRun: boolean;
}

/** Inicio do dia (Brasilia) em ISO UTC, para comparar com timestamps do banco. */
function inicioDoDiaIso(dia: string): string {
  return new Date(`${dia}T00:00:00-03:00`).toISOString();
}

export function montarResumo(db: Db, agora: Date, settings: { envioHabilitado: boolean; autoRun: boolean }): ResumoDiario {
  const dia = dataEmBrasilia(agora);
  const desde = inicioDoDiaIso(dia);
  const entreguesRows = db.listarPorStatus(["SINCRONIZADO"], 100000).filter((r) => (r.sincronizado_em ?? "") >= desde);
  const pendentes = db.listarPorStatus(["REGISTRADO"], 100000).length;
  const quarentena = db.listarPorStatus(["QUARENTENA"], 100000).length;
  const erros = db.listarPorStatus(["ERRO"], 1000).filter((r) => r.atualizado_em >= desde);
  return {
    dia,
    entregues: entreguesRows.length,
    valorEntregue: entreguesRows.reduce((acc, r) => acc + r.valor, 0),
    pendentes,
    emQuarentena: quarentena,
    falhasDefinitivas: erros.map((r) => ({
      venda: r.venda_numero, cliente: r.cliente_nome, documento: r.documento, valor: r.valor, vencimento: r.vencimento, motivo: r.motivo,
    })),
    envioHabilitado: settings.envioHabilitado,
    autoRun: settings.autoRun,
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function textoDoResumo(r: ResumoDiario): { subject: string; text: string } {
  const linhas = [
    `Resumo do dia ${formatarDataBR(r.dia)} — integracao Conta Azul → Questor Zen (ASSEJURC)`,
    "",
    `Entregues no Zen hoje: ${r.entregues} (${brl(r.valorEntregue)})`,
    `Aguardando publicacao: ${r.pendentes}`,
    `Em nova tentativa (quarentena): ${r.emQuarentena}`,
    `Falhas definitivas hoje: ${r.falhasDefinitivas.length}`,
  ];
  if (r.falhasDefinitivas.length > 0) {
    linhas.push("");
    for (const f of r.falhasDefinitivas) {
      linhas.push(`- Venda ${f.venda ?? "?"} | ${f.cliente} | ${f.documento ?? "sem CPF/CNPJ"} | ${brl(f.valor)} | venc. ${formatarDataBR(f.vencimento)} | ${f.motivo ?? "sem motivo registrado"}`);
    }
  }
  if (!r.envioHabilitado) {
    linhas.push("", "Atencao: o envio ao Zen esta DESABILITADO (chave geral). Nenhum boleto e publicado ate alguem ligar no painel.");
  } else if (!r.autoRun) {
    linhas.push("", "Modo automatico desligado: boletos so sobem pelo botao Ativar.");
  }
  linhas.push("", "Painel: https://eron.mlutegar.com");
  return { subject: `[IAZAN Sync] Resumo ${formatarDataBR(r.dia)}: ${r.entregues} entregue(s), ${r.pendentes} pendente(s), ${r.falhasDefinitivas.length} falha(s)`, text: linhas.join("\n") };
}

/** Deve enviar agora? So uma vez por dia, a partir das 18h de Brasilia. */
export function deveEnviarResumo(agora: Date, ultimoEnvioDia: string | null): boolean {
  const { hora } = partesEmBrasilia(agora);
  if (hora < HORA_RESUMO) return false;
  return ultimoEnvioDia !== dataEmBrasilia(agora);
}
