// Cliente da API Questor Zen para a publicacao de boletos no e-Doc.
// Ainda nao esta ligado ao /run nem ao agendador: os primeiros envios exigem
// uma empresa e um boleto de homologacao escolhidos explicitamente.

const MAX_PDF_BYTES = 20 * 1024 * 1024;

export class ZenError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ZenError";
  }
}

interface ZenCategory {
  Codigo: string;
  Descricao: string;
  Categorias?: ZenCategory[] | null;
  DeadFile?: boolean;
}

interface ZenClientRecord {
  CodigoCliente: string;
  InscricaoFederal: string;
  Desativado?: boolean | null;
}

export interface ZenBoletoInput {
  cnpj: string;
  pdf: Uint8Array;
  fileName: string;
  title: string;
  dueDate: string; // AAAA-MM-DD
  amount: number;
}

export interface ZenPublishResult {
  documentId: string;
  fileId: string;
  clientId: string;
  categoryId: string;
}

export class ZenClient {
  private readonly base: URL;
  private readonly token: string;

  constructor(baseUrl: string, token: string, private readonly fetcher: typeof fetch = fetch) {
    let base: URL;
    try {
      base = new URL(baseUrl);
    } catch {
      throw new ZenError("Dominio do Zen invalido.");
    }
    if (base.protocol !== "https:" || !base.hostname.endsWith(".app.questorpublico.com.br")) {
      throw new ZenError("O dominio do Zen deve usar HTTPS e pertencer ao Questor.");
    }
    if (base.username || base.password || base.search || base.hash || base.pathname !== "/") {
      throw new ZenError("Informe apenas a origem HTTPS do Zen, sem caminho ou parametros.");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(token)) {
      throw new ZenError("Token do Zen ausente ou invalido.");
    }
    this.base = base;
    this.token = token;
  }

  private endpoint(path: string): URL {
    return new URL(`/api/v1/${encodeURIComponent(this.token)}/${path}`, this.base);
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const operation = path.split("/")[0];
    try {
      const response = await this.fetcher(this.endpoint(path), {
        ...init,
        redirect: "manual", // nao envia o token a outro host por redirecionamento
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        // URL e corpo podem conter informacoes sensiveis; nunca entram no erro.
        throw new ZenError(`Zen respondeu HTTP ${response.status} em ${init.method ?? "GET"} ${operation}.`, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof ZenError) throw error;
      throw new ZenError(`Falha de rede ao acessar ${operation}.`);
    }
  }

  /** Consulta somente de leitura; encontra a categoria Boleto(s) ativa. */
  async getBoletoCategoryId(): Promise<string> {
    const response = await this.request("categorias");
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new ZenError("Categorias do Zen em formato inesperado.");

    const matches: string[] = [];
    const collect = (items: unknown[]): void => {
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const category = item as Partial<ZenCategory>;
        if (category.DeadFile === true) continue;
        if (typeof category.Descricao === "string" &&
            /^boletos?$/i.test(category.Descricao.trim()) && typeof category.Codigo === "string") {
          matches.push(category.Codigo);
        }
        if (Array.isArray(category.Categorias)) {
          collect(category.Categorias);
        }
      }
    };

    collect(raw);
    if (matches.length === 0) throw new ZenError("Categoria Boleto nao encontrada no Zen.");
    if (matches.length > 1) throw new ZenError("Ha mais de uma categoria Boleto no Zen; escolha a categoria correta antes de publicar.");
    return matches[0];
  }

  /** Consulta somente de leitura; confirma o CNPJ antes de usar CodigoCliente. */
  async getClientIdByCnpj(cnpj: string): Promise<string> {
    const digits = cnpj.replace(/\D/g, "");
    if (!/^\d{14}$/.test(digits)) throw new ZenError("CNPJ invalido.");

    const response = await this.request(`clientes/${digits}`);
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object") throw new ZenError("Cliente do Zen em formato inesperado.");
    const client = raw as Partial<ZenClientRecord>;
    if (client.Desativado === true) throw new ZenError("Cliente desativado no Zen.");
    if (typeof client.CodigoCliente !== "string" || !client.CodigoCliente) {
      throw new ZenError("CodigoCliente ausente na resposta do Zen.");
    }
    if (typeof client.InscricaoFederal !== "string" || client.InscricaoFederal.replace(/\D/g, "") !== digits) {
      throw new ZenError("O Zen retornou um cliente com CNPJ diferente.");
    }
    return client.CodigoCliente;
  }

  /** Etapa 1: envia o PDF bruto e recebe CodigoArquivo. */
  async uploadPdf(pdf: Uint8Array, fileName: string): Promise<string> {
    validatePdf(pdf, fileName);
    const response = await this.request(`upload/${encodeURIComponent(fileName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: Buffer.from(pdf),
    });
    return readId(response, "CodigoArquivo");
  }

  /** Etapa 2: registra o arquivo no e-Doc e recebe o ID do documento. */
  async createDocument(input: {
    categoryId: string;
    clientId: string;
    fileId: string;
    title: string;
    dueDate: string;
    amount: number;
  }): Promise<string> {
    const { categoryId, clientId, fileId, title, dueDate, amount } = input;
    if (![categoryId, clientId, fileId, title].every((value) => typeof value === "string" && value.trim())) {
      throw new ZenError("Dados obrigatorios do documento ausentes.");
    }
    validateBoletoFields(title, dueDate, amount);
    const [year, month, day] = dueDate.split("-");
    const response = await this.request("documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        CodigoCategoria: categoryId,
        CodigoCliente: clientId,
        CodigoArquivo: fileId,
        Titulo: title,
        Atributo: { DataVencimento: `${day}/${month}/${year}`, Valor: amount.toFixed(2) },
      }),
    });
    return readId(response, "CodigoDocumento");
  }

  /** Faz as consultas primeiro; so depois envia o arquivo e cria o documento. */
  async publishBoleto(input: ZenBoletoInput): Promise<ZenPublishResult> {
    validatePdf(input.pdf, input.fileName);
    validateBoletoFields(input.title, input.dueDate, input.amount);
    const [categoryId, clientId] = await Promise.all([
      this.getBoletoCategoryId(),
      this.getClientIdByCnpj(input.cnpj),
    ]);
    const fileId = await this.uploadPdf(input.pdf, input.fileName);
    const documentId = await this.createDocument({
      categoryId,
      clientId,
      fileId,
      title: input.title,
      dueDate: input.dueDate,
      amount: input.amount,
    });
    return { documentId, fileId, clientId, categoryId };
  }
}

function validatePdf(pdf: Uint8Array, fileName: string): void {
  if (!/^[A-Za-z0-9._-]+\.pdf$/i.test(fileName)) throw new ZenError("Nome do PDF invalido.");
  if (pdf.byteLength === 0 || pdf.byteLength > MAX_PDF_BYTES ||
      new TextDecoder().decode(pdf.subarray(0, 5)) !== "%PDF-") {
    throw new ZenError("PDF vazio, invalido ou maior que 20 MB.");
  }
}

function validateBoletoFields(title: string, dueDate: string, amount: number): void {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(`${dueDate}T00:00:00Z`) : null;
  if (!title.trim() || !date || Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dueDate || !Number.isFinite(amount) || amount <= 0) {
    throw new ZenError("Titulo, vencimento ou valor do boleto invalido.");
  }
}

async function readId(response: Response, label: string): Promise<string> {
  const body = (await response.text()).trim();
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    value = body;
  }
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ZenError(`${label} ausente ou inesperado na resposta do Zen.`);
  }
  return value;
}

/** Configuracao disponivel apenas no backend. Nao chame no frontend. */
export function zenFromEnv(): ZenClient {
  return new ZenClient(process.env.ZEN_BASE_URL ?? "", process.env.ZEN_API_TOKEN ?? "");
}
