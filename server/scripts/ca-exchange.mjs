// Troca manual do codigo de autorizacao da Conta Azul por tokens.
// Uso quando a URL de redirecionamento registrada no portal nao aponta para
// este servidor (ex.: https://google.com): o operador autoriza no navegador,
// copia a URL em que caiu (com ?code=...&state=...) e roda:
//   npm run ca:exchange -- "https://www.google.com/?code=XXXX&state=YYYY"
// Tambem aceita so o codigo. O codigo vale 3 minutos e e de uso unico.
import "dotenv/config";

const arg = process.argv[2]?.trim();
if (!arg) {
  console.error('Uso: npm run ca:exchange -- "<URL de retorno ou codigo>"');
  process.exit(1);
}

let code = arg;
if (/^https?:\/\//.test(arg)) {
  try {
    code = new URL(arg).searchParams.get("code") ?? "";
  } catch {
    code = "";
  }
}
if (!/^[A-Za-z0-9._~-]+$/.test(code)) {
  console.error("Nao encontrei um codigo valido na entrada (esperado ?code=... na URL).");
  process.exit(1);
}

try {
  const { exchangeCode, authStatus } = await import("../dist/contaazul.js");
  const tok = await exchangeCode(code);
  console.log(`Conta Azul conectada. access_token expira em ${new Date(tok.expiresAt).toLocaleString("pt-BR")}.`);
  console.log(JSON.stringify(authStatus(), null, 2));
} catch (error) {
  console.error(`Falha ao trocar o codigo: ${error?.message ?? "erro desconhecido"}`);
  if (error?.body) console.error(JSON.stringify(error.body));
  process.exitCode = 1;
}
