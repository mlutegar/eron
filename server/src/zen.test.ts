import { describe, expect, it, vi } from "vitest";
import { ZenClient, ZenError } from "./zen.js";

const base = "https://teste.app.questorpublico.com.br";
const token = "token-de-teste";
const pdf = Buffer.from("%PDF-1.4\nconteudo de teste");

function reply(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ZenClient", () => {
  it("consulta a categoria Boleto e confirma o CNPJ do cliente antes de publicar", async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const fetcher = vi.fn(async (url: URL, init: RequestInit) => {
      const path = url.pathname.split("/").slice(4).join("/");
      calls.push({ path, init });
      if (path === "categorias") {
        return reply([{ Codigo: "pai", Descricao: "Administrativo", Categorias: [
          { Codigo: "cat-boleto", Descricao: "Boletos", DeadFile: false },
        ] }]);
      }
      if (path.startsWith("clientes/")) {
        return reply({ CodigoCliente: "cliente-1", InscricaoFederal: "12.345.678/0001-90", Desativado: false });
      }
      if (path.startsWith("upload/")) return reply("arquivo-1");
      if (path === "documentos") return reply("documento-1");
      throw new Error("Endpoint inesperado no teste");
    });
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);

    const result = await client.publishBoleto({
      documento: "12.345.678/0001-90",
      pdf,
      fileName: "boleto-teste.pdf",
      title: "Boleto de teste",
      dueDate: "2026-10-15",
      amount: 10.5,
    });

    expect(result).toEqual({ documentId: "documento-1", fileId: "arquivo-1", clientId: "cliente-1", categoryId: "cat-boleto" });
    expect(calls.map((call) => call.path)).toEqual([
      "categorias", "clientes/12345678000190", "upload/boleto-teste.pdf", "documentos",
    ]);
    expect(calls[2].init.method).toBe("POST");
    expect(calls[2].init.body).toEqual(pdf);
    expect(JSON.parse(String(calls[3].init.body))).toMatchObject({
      CodigoCategoria: "cat-boleto",
      CodigoCliente: "cliente-1",
      CodigoArquivo: "arquivo-1",
      Atributo: { DataVencimento: "15/10/2026", Valor: "10.50" },
    });
    expect(calls.every((call) => call.init.redirect === "manual")).toBe(true);
  });

  it("aceita CPF (11 digitos) e consulta o cliente pelos digitos", async () => {
    const paths: string[] = [];
    const fetcher = vi.fn(async (url: URL) => {
      const path = url.pathname.split("/").slice(4).join("/");
      paths.push(path);
      if (path === "categorias") return reply([{ Codigo: "cat-boleto", Descricao: "Boleto" }]);
      if (path.startsWith("clientes/")) return reply({ CodigoCliente: "cliente-pf", InscricaoFederal: "413.239.838-21" });
      if (path.startsWith("upload/")) return reply("arquivo-1");
      if (path === "documentos") return reply("documento-1");
      throw new Error("Endpoint inesperado no teste");
    });
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);
    const result = await client.publishBoleto({
      documento: "413.239.838-21", pdf, fileName: "boleto-2246.pdf", title: "Venda 2246", dueDate: "2026-10-02", amount: 100,
    });
    expect(result.clientId).toBe("cliente-pf");
    expect(paths).toContain("clientes/41323983821");
  });

  it("recusa documento que nao e CPF nem CNPJ", async () => {
    const client = new ZenClient(base, token, vi.fn() as unknown as typeof fetch);
    await expect(client.getClientIdByDocumento("123")).rejects.toThrow("CPF/CNPJ invalido");
  });

  it("interrompe antes do upload se o Zen devolver outro CNPJ", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith("/categorias")) return reply([{ Codigo: "cat-boleto", Descricao: "Boleto" }]);
      return reply({ CodigoCliente: "cliente-errado", InscricaoFederal: "00.000.000/0001-00" });
    });
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);

    await expect(client.publishBoleto({
      documento: "12.345.678/0001-90", pdf, fileName: "boleto-teste.pdf", title: "Teste", dueDate: "2026-10-15", amount: 10,
    })).rejects.toThrow("CPF/CNPJ diferente");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("interrompe antes do upload se houver duas categorias Boleto", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith("/categorias")) return reply([
        { Codigo: "cat-1", Descricao: "Boleto" },
        { Codigo: "cat-2", Descricao: "Boletos" },
      ]);
      return reply({ CodigoCliente: "cliente-1", InscricaoFederal: "12345678000190" });
    });
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);

    await expect(client.publishBoleto({
      documento: "12345678000190", pdf, fileName: "boleto-teste.pdf", title: "Teste", dueDate: "2026-10-15", amount: 10,
    })).rejects.toThrow("mais de uma categoria Boleto");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("nao considera publicado quando a resposta de documentos nao traz ID", async () => {
    const fetcher = vi.fn(async (url: URL) => {
      if (url.pathname.endsWith("/categorias")) return reply([{ Codigo: "cat-boleto", Descricao: "Boleto" }]);
      if (url.pathname.includes("/clientes/")) return reply({ CodigoCliente: "cliente-1", InscricaoFederal: "12345678000190" });
      if (url.pathname.includes("/upload/")) return reply("arquivo-1");
      return reply({ ok: true });
    });
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);
    await expect(client.publishBoleto({
      documento: "12345678000190", pdf, fileName: "boleto-teste.pdf", title: "Teste", dueDate: "2026-10-15", amount: 10,
    })).rejects.toThrow("CodigoDocumento ausente");
  });

  it("rejeita PDF invalido sem enviar dados", async () => {
    const fetcher = vi.fn();
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);
    await expect(client.uploadPdf(Buffer.from("invalido"), "teste.pdf")).rejects.toThrow("PDF vazio, invalido");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejeita vencimento invalido antes de consultar ou enviar ao Zen", async () => {
    const fetcher = vi.fn();
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);
    await expect(client.publishBoleto({
      documento: "12345678000190", pdf, fileName: "boleto-teste.pdf", title: "Teste", dueDate: "2026-02-31", amount: 10,
    })).rejects.toThrow("vencimento ou valor");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("nao inclui o token em erros HTTP", async () => {
    const fetcher = vi.fn(async () => reply({ error: "falha" }, 401));
    const client = new ZenClient(base, token, fetcher as unknown as typeof fetch);
    const error = await client.getBoletoCategoryId().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ZenError);
    expect(String(error)).not.toContain(token);
  });
});
