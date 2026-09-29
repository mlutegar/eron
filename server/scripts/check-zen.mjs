// Verifica acesso de leitura ao Zen sem expor o token nem alterar documentos.
import "dotenv/config";

const baseValue = process.env.ZEN_BASE_URL;
const token = process.env.ZEN_API_TOKEN;

if (!baseValue || !token) {
  console.error("Defina ZEN_BASE_URL e ZEN_API_TOKEN em server/.env.");
  process.exit(1);
}

let base;
try {
  base = new URL(baseValue);
} catch {
  console.error("ZEN_BASE_URL invalida.");
  process.exit(1);
}

if (base.protocol !== "https:" || !base.hostname.endsWith(".app.questorpublico.com.br")) {
  console.error("ZEN_BASE_URL deve apontar para o dominio HTTPS do Questor Zen.");
  process.exit(1);
}

const url = new URL(`/api/v1/${encodeURIComponent(token)}/categorias`, base);

try {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    console.error(`Zen respondeu HTTP ${response.status}. Confira o token e as permissoes da conta.`);
    process.exit(1);
  }

  const categories = await response.json();
  if (!Array.isArray(categories)) {
    console.error("Zen respondeu em um formato inesperado.");
    process.exit(1);
  }

  const hasBoleto = (items) => items.some((item) =>
    /boleto/i.test(item?.Descricao ?? "") ||
    (Array.isArray(item?.Categorias) && hasBoleto(item.Categorias)),
  );

  console.log(`Zen API: acesso de leitura confirmado (HTTP ${response.status}).`);
  console.log(`Categoria Boleto: ${hasBoleto(categories) ? "encontrada" : "nao encontrada"}.`);
  if (!hasBoleto(categories)) process.exitCode = 1;
} catch (error) {
  console.error(`Falha na consulta ao Zen: ${error?.name ?? "erro desconhecido"}.`);
  process.exitCode = 1;
}
