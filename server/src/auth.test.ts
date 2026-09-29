import { describe, expect, it } from "vitest";
import { AuthService, hashSenha, verificarSenha } from "./auth.js";
import { Db } from "./db.js";

const AGORA = new Date("2026-10-01T12:00:00Z");

function servico(now: () => Date = () => AGORA) {
  const db = Db.open(":memory:");
  const auth = new AuthService(db, "segredo-de-teste", now);
  return { db, auth };
}

describe("senhas", () => {
  it("hash scrypt verifica a senha certa e recusa a errada", () => {
    const h = hashSenha("Senha@123456");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verificarSenha("Senha@123456", h)).toBe(true);
    expect(verificarSenha("Senha@12345", h)).toBe(false);
    expect(verificarSenha("x", "lixo")).toBe(false);
  });
});

describe("AuthService", () => {
  it("sem usuarios nao ha sessao; criar usuario permite login", () => {
    const { auth } = servico();
    expect(auth.temUsuarios()).toBe(false);
    expect(auth.login("heron", "Senha@123456", "ip1")).toBeNull();
    auth.criarOuAtualizarUsuario("Heron", "Senha@123456");
    expect(auth.temUsuarios()).toBe(true);
    const r = auth.login("heron", "Senha@123456", "ip1");
    expect(r?.sessao.sub).toBe("heron");
    expect(auth.login("heron", "errada", "ip1")).toBeNull();
  });

  it("valida login e senha fracos ao cadastrar", () => {
    const { auth } = servico();
    expect(() => auth.criarOuAtualizarUsuario("ab", "Senha@123456")).toThrow(/login invalido/);
    expect(() => auth.criarOuAtualizarUsuario("heron", "curta")).toThrow(/senha muito curta/);
  });

  it("token de sessao valida, expira em 12h e recusa adulteracao", () => {
    let relogio = AGORA;
    const { auth } = servico(() => relogio);
    auth.criarOuAtualizarUsuario("heron", "Senha@123456");
    const { token } = auth.login("heron", "Senha@123456", "ip1")!;
    expect(auth.validar(token)?.sub).toBe("heron");
    expect(auth.validar(`${token}x`)).toBeNull();
    const [corpo] = token.split(".");
    expect(auth.validar(`${corpo}.assinatura-falsa`)).toBeNull();
    relogio = new Date(AGORA.getTime() + 12 * 3600_000 + 1000);
    expect(auth.validar(token)).toBeNull();
  });

  it("bloqueia a origem apos 5 falhas em 1 minuto", () => {
    let relogio = AGORA;
    const { auth } = servico(() => relogio);
    auth.criarOuAtualizarUsuario("heron", "Senha@123456");
    for (let i = 0; i < 5; i++) expect(auth.login("heron", "errada", "ip1")).toBeNull();
    expect(auth.bloqueado("ip1")).toBe(true);
    expect(auth.login("heron", "Senha@123456", "ip1")).toBeNull(); // certa, mas bloqueado
    expect(auth.login("heron", "Senha@123456", "ip2")).not.toBeNull(); // outra origem segue
    relogio = new Date(AGORA.getTime() + 61_000);
    expect(auth.login("heron", "Senha@123456", "ip1")).not.toBeNull();
  });

  it("segredos diferentes nao aceitam o token um do outro", () => {
    const { auth } = servico();
    auth.criarOuAtualizarUsuario("heron", "Senha@123456");
    const { token } = auth.login("heron", "Senha@123456", "ip1")!;
    const outro = new AuthService(Db.open(":memory:"), "outro-segredo", () => AGORA);
    expect(outro.validar(token)).toBeNull();
  });
});
