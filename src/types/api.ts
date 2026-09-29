// Contrato de dados da integracao Conta Azul -> Questor Zen.
// Reflete os campos validados em campo (Venda 1591 / IUGU IP).
// Quando o backend Node existir, a camada src/api/client.ts passa a
// buscar via HTTP mantendo exatamente estes tipos.

export type SyncStatus =
  | "SINCRONIZADO" // boleto publicado no Zen com sucesso
  | "REGISTRADO" // cobranca registrada na CA, aguardando sync
  | "QUARENTENA" // precisa de intervencao humana
  | "ERRO"; // falha tecnica no upload

export interface Boleto {
  idCobranca: string; // id_cobranca (Conta Azul)
  idParcela: string; // id_parcela (Conta Azul)
  vendaId: number; // numero da venda na CA
  cliente: string; // razao social do cliente final
  cnpj: string; // CNPJ do cliente final
  valor: number; // em reais
  vencimento: string; // ISO date
  status: SyncStatus;
  empresaZen: string | null; // empresa correspondente no Zen (null se nao mapeada)
  documentoZenId: string | null; // id do e-Doc criado no Zen
  emitidoEm: string; // ISO datetime
  sincronizadoEm: string | null; // ISO datetime
}

export interface SyncLogEntry {
  id: string;
  boleto: Boleto;
  timestamp: string; // ISO datetime da tentativa
  status: SyncStatus;
  mensagem: string; // detalhe legivel
}

export interface QuarantineItem {
  id: string;
  boleto: Boleto;
  motivo: string; // ex: "CNPJ nao mapeado no Zen"
  desde: string; // ISO datetime
}

export interface ClientMapping {
  cnpj: string;
  clienteContaAzul: string;
  empresaZen: string | null;
  situacao: "MAPEADO" | "PENDENTE";
}

export type HealthState = "OK" | "ATENCAO" | "FALHA";

export interface ServiceHealth {
  chave: string; // identificador do servico
  nome: string; // nome legivel
  estado: HealthState;
  detalhe: string;
}

export interface SystemHealth {
  ultimaSync: string; // ISO datetime
  proximaSync: string; // ISO datetime
  intervaloMin: number; // 15
  servicos: ServiceHealth[];
}

export interface OverviewCounts {
  hoje: number;
  semana: number;
  mes: number;
  emQuarentena: number;
  valorMes: number;
}

export interface Overview {
  counts: OverviewCounts;
  health: SystemHealth;
  ultimos: SyncLogEntry[];
}
