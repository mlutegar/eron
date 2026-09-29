// Envio unico e controlado de UM boleto da Conta Azul para o e-Doc do Zen.
// Homologacao ponta a ponta: os ids sao passados explicitamente, nunca
// descobertos sozinhos. Sem --confirmar, apenas simula (consultas de leitura
// + download do PDF) e mostra o que seria enviado.
//
// Uso:
//   npm run publicar:teste -- --parcela <id> --documento <cpf/cnpj>            (simulacao)
//   npm run publicar:teste -- --parcela <id> --documento <cpf/cnpj> --confirmar (envio real)
import "dotenv/config";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const idParcela = opt("parcela");
const documento = opt("documento");
const confirmar = args.includes("--confirmar");

if (!idParcela || !/^[A-Za-z0-9-]+$/.test(idParcela) || !documento) {
  console.error("Uso: npm run publicar:teste -- --parcela <id da parcela CA> --documento <cpf/cnpj> [--confirmar]");
  process.exit(1);
}

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

try {
  const { contaAzul } = await import("../dist/contaazul.js");
  const { zenFromEnv } = await import("../dist/zen.js");
  const zen = zenFromEnv();

  // 1) Parcela na Conta Azul -> solicitacao de cobranca (boleto)
  const parcela = await contaAzul.detalheParcela(idParcela);
  const cobrancas = (parcela.solicitacoes_cobrancas ?? []).filter(
    (c) => c.tipo_solicitacao_cobranca === "BOLETO" && c.status_solicitacao_cobranca === "REGISTRADO",
  );
  if (parcela.metodo_pagamento !== "BOLETO_BANCARIO" || cobrancas.length !== 1) {
    throw new Error(`parcela nao tem exatamente 1 boleto REGISTRADO (metodo=${parcela.metodo_pagamento}, boletos=${cobrancas.length})`);
  }
  const cobranca = cobrancas[0];
  const numeroVenda = parcela.evento?.codigo_referencia ?? "?";
  const valor = Number(cobranca.valor_composicao?.valor_liquido ?? parcela.nao_pago);
  const vencimento = cobranca.data_vencimento ?? parcela.data_vencimento;

  // 2) Cobranca + PDF
  const status = await contaAzul.statusCobranca(cobranca.id);
  if (status.status !== "REGISTRADO") throw new Error(`cobranca com status ${status.status}`);
  const pdf = await contaAzul.baixarPdfBoleto(cobranca.id);
  const dir = await mkdtemp(join(tmpdir(), "eron-publicar-"));
  const arquivoLocal = join(dir, "boleto.pdf");
  await writeFile(arquivoLocal, pdf, { mode: 0o600 });

  // 3) Zen: categoria Boleto e cliente pelo CPF/CNPJ (so leitura)
  const [categoryId, clientId] = await Promise.all([
    zen.getBoletoCategoryId(),
    zen.getClientIdByDocumento(documento),
  ]);

  const envio = {
    documento,
    pdf,
    fileName: `boleto-venda-${numeroVenda}.pdf`,
    title: `Boleto Venda ${numeroVenda} - venc. ${vencimento.split("-").reverse().join("/")}`,
    dueDate: vencimento,
    amount: valor,
  };

  console.log("=== O que seria enviado ao Zen ===");
  console.log(`Venda:        ${numeroVenda}`);
  console.log(`Parcela CA:   ${idParcela}`);
  console.log(`Cobranca CA:  ${cobranca.id}`);
  console.log(`Valor:        ${brl(valor)}`);
  console.log(`Vencimento:   ${vencimento}`);
  console.log(`PDF:          ${pdf.byteLength} bytes (copia em ${arquivoLocal})`);
  console.log(`Zen cliente:  ${clientId} (documento ${documento})`);
  console.log(`Zen pasta:    ${categoryId}`);
  console.log(`Arquivo:      ${envio.fileName}`);
  console.log(`Titulo:       ${envio.title}`);

  if (!confirmar) {
    console.log("\nSIMULACAO: nada foi enviado ao Zen. Repita com --confirmar para enviar.");
    process.exit(0);
  }

  console.log("\nEnviando ao Zen...");
  const result = await zen.publishBoleto(envio);
  console.log("ENVIADO. Resultado do Zen:");
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Falha: ${error?.message ?? "erro desconhecido"}`);
  process.exitCode = 1;
}
