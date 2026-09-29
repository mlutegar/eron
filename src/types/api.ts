// Contrato de dados da integracao Conta Azul -> Questor Zen.
// Reflete os campos validados em campo (Venda 1591 / IUGU IP).
// Definido com Zod: os schemas validam o payload do backend em runtime
// (src/api/client.ts) e os tipos TypeScript sao derivados via z.infer,
// mantendo uma unica fonte de verdade para contrato + validacao.

import { z } from "zod";

export const SyncStatusSchema = z.enum([
  "SINCRONIZADO", // boleto publicado no Zen com sucesso
  "REGISTRADO", // cobranca registrada na CA, aguardando sync
  "QUARENTENA", // precisa de intervencao humana
  "ERRO", // falha tecnica no upload
]);
export type SyncStatus = z.infer<typeof SyncStatusSchema>;

export const BoletoSchema = z.object({
  idCobranca: z.string(), // id_cobranca (Conta Azul)
  idParcela: z.string(), // id_parcela (Conta Azul)
  vendaId: z.number(), // numero da venda na CA
  cliente: z.string(), // razao social do cliente final
  cnpj: z.string(), // CNPJ do cliente final
  valor: z.number(), // em reais
  vencimento: z.string(), // ISO date
  status: SyncStatusSchema,
  empresaZen: z.string().nullable(), // empresa correspondente no Zen (null se nao mapeada)
  documentoZenId: z.string().nullable(), // id do e-Doc criado no Zen
  emitidoEm: z.string(), // ISO datetime
  sincronizadoEm: z.string().nullable(), // ISO datetime
});
export type Boleto = z.infer<typeof BoletoSchema>;

export const SyncLogEntrySchema = z.object({
  id: z.string(),
  boleto: BoletoSchema,
  timestamp: z.string(), // ISO datetime da tentativa
  status: SyncStatusSchema,
  mensagem: z.string(), // detalhe legivel
});
export type SyncLogEntry = z.infer<typeof SyncLogEntrySchema>;

export const QuarantineItemSchema = z.object({
  id: z.string(),
  boleto: BoletoSchema,
  motivo: z.string(), // ex: "CNPJ nao mapeado no Zen"
  desde: z.string(), // ISO datetime
});
export type QuarantineItem = z.infer<typeof QuarantineItemSchema>;

export const ClientMappingSchema = z.object({
  cnpj: z.string(),
  clienteContaAzul: z.string(),
  empresaZen: z.string().nullable(),
  situacao: z.enum(["MAPEADO", "PENDENTE"]),
});
export type ClientMapping = z.infer<typeof ClientMappingSchema>;

export const HealthStateSchema = z.enum(["OK", "ATENCAO", "FALHA"]);
export type HealthState = z.infer<typeof HealthStateSchema>;

export const ServiceHealthSchema = z.object({
  chave: z.string(), // identificador do servico
  nome: z.string(), // nome legivel
  estado: HealthStateSchema,
  detalhe: z.string(),
});
export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const SystemHealthSchema = z.object({
  ultimaSync: z.string(), // ISO datetime
  proximaSync: z.string(), // ISO datetime
  intervaloMin: z.number(), // 15
  servicos: z.array(ServiceHealthSchema),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export const OverviewCountsSchema = z.object({
  hoje: z.number(),
  semana: z.number(),
  mes: z.number(),
  emQuarentena: z.number(),
  valorMes: z.number(),
});
export type OverviewCounts = z.infer<typeof OverviewCountsSchema>;

export const OverviewSchema = z.object({
  counts: OverviewCountsSchema,
  health: SystemHealthSchema,
  ultimos: z.array(SyncLogEntrySchema),
});
export type Overview = z.infer<typeof OverviewSchema>;

// Resultado de uma execucao do robo (acionada pela tela inicial "Ativar").
// Cada item diz se o boleto subiu no e-Doc do Zen (ok) e a mensagem/motivo.
export const RunItemSchema = z.object({
  boleto: BoletoSchema,
  ok: z.boolean(),
  mensagem: z.string(), // "Enviado ao Zen (empresa X)" ou motivo da falha
});
export type RunItem = z.infer<typeof RunItemSchema>;

export const RunResultSchema = z.object({
  executadoEm: z.string(), // ISO datetime da execucao
  total: z.number(),
  subiram: z.number(),
  naoSubiram: z.number(),
  valorPublicado: z.number(), // soma dos boletos que subiram
  itens: z.array(RunItemSchema),
});
export type RunResult = z.infer<typeof RunResultSchema>;

// Ultima execucao persistida (nula se nunca rodou).
export const LastRunSchema = RunResultSchema.nullable();
export type LastRun = z.infer<typeof LastRunSchema>;

// Preferencias operacionais (modo automatico do agendador).
export const SettingsSchema = z.object({
  autoRun: z.boolean(),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Coletores de lista reutilizados na validacao das respostas HTTP.
export const SyncLogListSchema = z.array(SyncLogEntrySchema);
export const QuarantineListSchema = z.array(QuarantineItemSchema);
export const ClientMappingListSchema = z.array(ClientMappingSchema);
export const BoletoListSchema = z.array(BoletoSchema);
