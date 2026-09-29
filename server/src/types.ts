// Contrato compartilhado com o front (mesma forma de src/types/api.ts).
// Validado com Zod para que as respostas do server sejam garantidamente
// conformes ao contrato antes de sair pela rede.
import { z } from "zod";

export const SyncStatusSchema = z.enum(["SINCRONIZADO", "REGISTRADO", "QUARENTENA", "ERRO"]);

export const BoletoSchema = z.object({
  idCobranca: z.string(),
  idParcela: z.string(),
  vendaId: z.number(),
  cliente: z.string(),
  cnpj: z.string(),
  valor: z.number(),
  vencimento: z.string(),
  status: SyncStatusSchema,
  empresaZen: z.string().nullable(),
  documentoZenId: z.string().nullable(),
  emitidoEm: z.string(),
  sincronizadoEm: z.string().nullable(),
});
export type Boleto = z.infer<typeof BoletoSchema>;

export const SyncLogEntrySchema = z.object({
  id: z.string(),
  boleto: BoletoSchema,
  timestamp: z.string(),
  status: SyncStatusSchema,
  mensagem: z.string(),
});
export type SyncLogEntry = z.infer<typeof SyncLogEntrySchema>;

export const QuarantineItemSchema = z.object({
  id: z.string(),
  boleto: BoletoSchema,
  motivo: z.string(),
  desde: z.string(),
});
export type QuarantineItem = z.infer<typeof QuarantineItemSchema>;

export const ClientMappingSchema = z.object({
  cnpj: z.string(),
  clienteContaAzul: z.string(),
  empresaZen: z.string().nullable(),
  situacao: z.enum(["MAPEADO", "PENDENTE"]),
});
export type ClientMapping = z.infer<typeof ClientMappingSchema>;

export const ServiceHealthSchema = z.object({
  chave: z.string(),
  nome: z.string(),
  estado: z.enum(["OK", "ATENCAO", "FALHA"]),
  detalhe: z.string(),
});

export const SystemHealthSchema = z.object({
  ultimaSync: z.string(),
  proximaSync: z.string(),
  intervaloMin: z.number(),
  servicos: z.array(ServiceHealthSchema),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export const OverviewSchema = z.object({
  counts: z.object({
    hoje: z.number(),
    semana: z.number(),
    mes: z.number(),
    emQuarentena: z.number(),
    valorMes: z.number(),
  }),
  health: SystemHealthSchema,
  ultimos: z.array(SyncLogEntrySchema),
});
export type Overview = z.infer<typeof OverviewSchema>;

// Resultado de uma execucao do robo (tela "Ativar").
export const RunItemSchema = z.object({
  boleto: BoletoSchema,
  ok: z.boolean(),
  mensagem: z.string(),
});
export type RunItem = z.infer<typeof RunItemSchema>;

export const RunResultSchema = z.object({
  executadoEm: z.string(),
  total: z.number(),
  subiram: z.number(),
  naoSubiram: z.number(),
  valorPublicado: z.number(), // soma dos boletos que subiram
  itens: z.array(RunItemSchema),
});
export type RunResult = z.infer<typeof RunResultSchema>;

// Ultima execucao persistida (pode ser nula se nunca rodou).
export const LastRunSchema = RunResultSchema.nullable();
export type LastRun = z.infer<typeof LastRunSchema>;

// Preferencias operacionais (ex.: modo automatico do agendador).
export const SettingsSchema = z.object({
  autoRun: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const BoletoListSchema = z.array(BoletoSchema);
