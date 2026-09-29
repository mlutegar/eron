// Teste de leitura de uma unica cobranca. Nunca publica no Questor Zen.
import "dotenv/config";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const idCobranca = process.argv[2];
if (!idCobranca || !/^[A-Za-z0-9-]+$/.test(idCobranca)) {
  console.error("Uso: npm run probe:boleto -- ID_DA_COBRANCA");
  process.exit(1);
}

try {
  const { contaAzul } = await import("../dist/contaazul.js");
  const pdf = await contaAzul.baixarPdfBoleto(idCobranca);
  const dir = await mkdtemp(join(tmpdir(), "eron-boleto-"));
  const file = join(dir, "boleto.pdf");
  await writeFile(file, pdf, { mode: 0o600 });
  console.log(`PDF valido (${pdf.byteLength} bytes), salvo em: ${file}`);
  console.log("Nenhum documento foi enviado ao Zen.");
} catch (error) {
  console.error(`Nao foi possivel baixar o PDF: ${error?.message ?? "erro desconhecido"}`);
  process.exitCode = 1;
}
