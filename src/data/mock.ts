import type {
  Boleto,
  ClientMapping,
  QuarantineItem,
  SyncLogEntry,
  SystemHealth,
} from "../types/api";

// Base fictícia coerente com o caso real (ASSEJURC / IUGU IP / Venda 1591).
// Datas fixas para evitar dependência de relógio no mock.

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

export const boletos: Boleto[] = [
  boleto({
    idCobranca: "CBR-1591",
    idParcela: "PARC-1591",
    vendaId: 1591,
    cliente: "Padaria Pao Quente LTDA",
    cnpj: "12.345.678/0001-90",
    valor: 10.0,
    vencimento: "2026-10-05",
    status: "SINCRONIZADO",
    empresaZen: "Padaria Pao Quente",
    documentoZenId: "EDOC-88213",
    emitidoEm: "2026-09-28T08:41:00-03:00",
    sincronizadoEm: "2026-09-28T08:46:00-03:00",
  }),
  boleto({
    idCobranca: "CBR-1592",
    vendaId: 1592,
    cliente: "Auto Pecas Veloz ME",
    cnpj: "98.765.432/0001-11",
    valor: 1840.5,
    vencimento: "2026-10-12",
    status: "SINCRONIZADO",
    empresaZen: "Auto Pecas Veloz",
    documentoZenId: "EDOC-88214",
    emitidoEm: "2026-09-28T09:02:00-03:00",
    sincronizadoEm: "2026-09-28T09:16:00-03:00",
  }),
  boleto({
    idCobranca: "CBR-1593",
    vendaId: 1593,
    cliente: "Clinica Vida Plena LTDA",
    cnpj: "45.111.222/0001-33",
    valor: 620.0,
    vencimento: "2026-10-08",
    status: "REGISTRADO",
    empresaZen: "Clinica Vida Plena",
    documentoZenId: null,
    sincronizadoEm: null,
    emitidoEm: "2026-09-28T09:31:00-03:00",
  }),
  boleto({
    idCobranca: "CBR-1594",
    vendaId: 1594,
    cliente: "Mercado Central EIRELI",
    cnpj: "77.888.999/0001-55",
    valor: 3290.9,
    vencimento: "2026-10-15",
    status: "QUARENTENA",
    empresaZen: null,
    documentoZenId: null,
    sincronizadoEm: null,
    emitidoEm: "2026-09-28T09:44:00-03:00",
  }),
  boleto({
    idCobranca: "CBR-1595",
    vendaId: 1595,
    cliente: "Studio Foco Fotografia",
    cnpj: "33.222.111/0001-77",
    valor: 450.0,
    vencimento: "2026-10-09",
    status: "ERRO",
    empresaZen: "Studio Foco",
    documentoZenId: null,
    sincronizadoEm: null,
    emitidoEm: "2026-09-28T09:52:00-03:00",
  }),
  boleto({
    idCobranca: "CBR-1588",
    vendaId: 1588,
    cliente: "Escritorio Contabil Norte",
    cnpj: "10.203.040/0001-05",
    valor: 980.0,
    vencimento: "2026-10-03",
    status: "SINCRONIZADO",
    empresaZen: "Contabil Norte",
    documentoZenId: "EDOC-88190",
    emitidoEm: "2026-09-27T14:10:00-03:00",
    sincronizadoEm: "2026-09-27T14:15:00-03:00",
  }),
];

export const syncLog: SyncLogEntry[] = [
  {
    id: "L-1010",
    boleto: boletos[4],
    timestamp: "2026-09-28T09:52:30-03:00",
    status: "ERRO",
    mensagem: "Falha no upload e-Doc: timeout do Web Service Zen. Reprocessamento agendado.",
  },
  {
    id: "L-1009",
    boleto: boletos[3],
    timestamp: "2026-09-28T09:44:12-03:00",
    status: "QUARENTENA",
    mensagem: "CNPJ 77.888.999/0001-55 nao encontrado nas empresas do Zen.",
  },
  {
    id: "L-1008",
    boleto: boletos[2],
    timestamp: "2026-09-28T09:31:05-03:00",
    status: "REGISTRADO",
    mensagem: "Cobranca registrada na Conta Azul. Aguardando proxima janela de sync.",
  },
  {
    id: "L-1007",
    boleto: boletos[1],
    timestamp: "2026-09-28T09:16:00-03:00",
    status: "SINCRONIZADO",
    mensagem: "Boleto publicado no Zen (EDOC-88214) para Auto Pecas Veloz.",
  },
  {
    id: "L-1006",
    boleto: boletos[0],
    timestamp: "2026-09-28T08:46:00-03:00",
    status: "SINCRONIZADO",
    mensagem: "Boleto publicado no Zen (EDOC-88213) para Padaria Pao Quente.",
  },
  {
    id: "L-1005",
    boleto: boletos[5],
    timestamp: "2026-09-27T14:15:00-03:00",
    status: "SINCRONIZADO",
    mensagem: "Boleto publicado no Zen (EDOC-88190) para Contabil Norte.",
  },
];

export const quarantine: QuarantineItem[] = [
  {
    id: "Q-2001",
    boleto: boletos[3],
    motivo: "CNPJ nao mapeado no Zen",
    desde: "2026-09-28T09:44:12-03:00",
  },
];

export const clientMap: ClientMapping[] = [
  {
    cnpj: "12.345.678/0001-90",
    clienteContaAzul: "Padaria Pao Quente LTDA",
    empresaZen: "Padaria Pao Quente",
    situacao: "MAPEADO",
  },
  {
    cnpj: "98.765.432/0001-11",
    clienteContaAzul: "Auto Pecas Veloz ME",
    empresaZen: "Auto Pecas Veloz",
    situacao: "MAPEADO",
  },
  {
    cnpj: "45.111.222/0001-33",
    clienteContaAzul: "Clinica Vida Plena LTDA",
    empresaZen: "Clinica Vida Plena",
    situacao: "MAPEADO",
  },
  {
    cnpj: "10.203.040/0001-05",
    clienteContaAzul: "Escritorio Contabil Norte",
    empresaZen: "Contabil Norte",
    situacao: "MAPEADO",
  },
  {
    cnpj: "33.222.111/0001-77",
    clienteContaAzul: "Studio Foco Fotografia",
    empresaZen: "Studio Foco",
    situacao: "MAPEADO",
  },
  {
    cnpj: "77.888.999/0001-55",
    clienteContaAzul: "Mercado Central EIRELI",
    empresaZen: null,
    situacao: "PENDENTE",
  },
];

export const health: SystemHealth = {
  ultimaSync: "2026-09-28T09:52:00-03:00",
  proximaSync: "2026-09-28T10:07:00-03:00",
  intervaloMin: 15,
  servicos: [
    {
      chave: "auth-ca",
      nome: "Autenticacao Conta Azul (OAuth2)",
      estado: "OK",
      detalhe: "Token valido. Renovacao automatica ativa.",
    },
    {
      chave: "auth-zen",
      nome: "Web Service Questor Zen",
      estado: "ATENCAO",
      detalhe: "1 timeout nas ultimas 24h. Monitorando.",
    },
    {
      chave: "pdf",
      nome: "Download PDF do boleto (endpoint publico)",
      estado: "OK",
      detalhe: "public.contaazul.com respondendo normalmente.",
    },
    {
      chave: "db",
      nome: "Banco de dados (PostgreSQL)",
      estado: "OK",
      detalhe: "Conexao saudavel. Backup diario as 03:00.",
    },
    {
      chave: "scheduler",
      nome: "Agendador (a cada 15 min)",
      estado: "OK",
      detalhe: "Ultima execucao concluida sem erros.",
    },
  ],
};
