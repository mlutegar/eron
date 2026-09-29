// Explorador somente-leitura da API da Conta Azul: faz um GET autenticado e
// imprime o JSON. Serve para conferir o formato das respostas na homologacao.
// Uso: npm run ca:get -- /v1/financeiro/eventos-financeiros/contas-a-receber/buscar?pagina=1
import "dotenv/config";

const path = process.argv[2];
if (!path || !path.startsWith("/")) {
  console.error("Uso: npm run ca:get -- /caminho/da/api?query");
  process.exit(1);
}

try {
  const { contaAzul } = await import("../dist/contaazul.js");
  const token = await contaAzul.getValidAccessToken();
  const base = process.env.CA_API_BASE ?? "https://api-v2.contaazul.com";
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  console.log(`HTTP ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 2000));
  }
  if (!res.ok) process.exitCode = 1;
} catch (error) {
  console.error(`Falha: ${error?.message ?? "erro desconhecido"}`);
  process.exitCode = 1;
}
