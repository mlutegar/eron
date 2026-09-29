// Gerencia os usuarios do painel (SQLite, senha com scrypt).
//   npm run usuario -- criar <login>      (pede a senha no terminal, sem eco)
//   npm run usuario -- listar
//   npm run usuario -- remover <login>
// A senha tambem pode vir da variavel SENHA (util em automacao); nunca passe por argumento.
import "dotenv/config";
import { createInterface } from "node:readline";

const [acao, login] = process.argv.slice(2);
if (!acao || !["criar", "listar", "remover"].includes(acao) || (acao !== "listar" && !login)) {
  console.error("Uso: npm run usuario -- criar <login> | listar | remover <login>");
  process.exit(1);
}

function perguntarSenha(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const original = rl._writeToOutput;
    rl.question(prompt, (resp) => {
      rl._writeToOutput = original;
      process.stdout.write("\n");
      rl.close();
      resolve(resp);
    });
    // Sem eco: engole o que for digitado depois do prompt.
    rl._writeToOutput = (s) => { if (s.startsWith(prompt)) original.call(rl, prompt); };
  });
}

try {
  const { Db } = await import("../dist/db.js");
  const { AuthService } = await import("../dist/auth.js");
  const db = Db.open(process.env.DB_PATH ?? ".eron.db");
  const auth = new AuthService(db, process.env.SESSION_SECRET ?? "");

  if (acao === "listar") {
    const lista = auth.listarUsuarios();
    if (lista.length === 0) console.log("Nenhum usuario cadastrado (API aberta se API_TOKEN tambem estiver vazio).");
    for (const u of lista) console.log(`${u.login}\tcriado ${u.criado_em}\tatualizado ${u.atualizado_em}`);
  } else if (acao === "criar") {
    const senha = process.env.SENHA ?? (await perguntarSenha(`Senha para ${login}: `));
    const confirma = process.env.SENHA ?? (await perguntarSenha("Repita a senha: "));
    if (senha !== confirma) throw new Error("as senhas nao conferem");
    auth.criarOuAtualizarUsuario(login, senha);
    console.log(`Usuario ${login.trim().toLowerCase()} salvo.`);
  } else {
    console.log(auth.removerUsuario(login) ? `Usuario ${login} removido.` : `Usuario ${login} nao encontrado.`);
  }
  db.close();
} catch (error) {
  console.error(`Falha: ${error?.message ?? "erro desconhecido"}`);
  process.exitCode = 1;
}
