import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usingMock } from "../api/client";

// Autenticacao do painel.
//  - Com API real (VITE_API_URL): POST /auth/login devolve um token de sessao
//    assinado pelo backend (12h). Ele vai no header Authorization de toda chamada
//    (src/api/client.ts) e um 401 derruba a sessao aqui.
//  - No modo mock: valida contra credenciais de ambiente, so para demonstracao.

const SESSION_KEY = "iazan.session";
const MOCK_KEY = "iazan.auth";
const MOCK_USER = import.meta.env.VITE_LOGIN_USER ?? "admin";
const MOCK_PASS = import.meta.env.VITE_LOGIN_PASS ?? "iazan";
const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

/** Disparado por src/api/client.ts quando o backend responde 401. */
export const UNAUTHORIZED_EVENT = "iazan:unauthorized";

interface Session {
  token: string;
  usuario: string;
  expiraEm: string;
}

export type LoginResult = { ok: true } | { ok: false; mensagem: string };

interface AuthValue {
  authenticated: boolean;
  usuario: string | null;
  login: (user: string, pass: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.token || !s.expiraEm || new Date(s.expiraEm).getTime() <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

/** Token da sessao atual (para o header Authorization). */
export function getSessionToken(): string | null {
  return readSession()?.token ?? null;
}

async function loginHttp(user: string, pass: string): Promise<LoginResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario: user, senha: pass }),
    });
  } catch {
    return { ok: false, mensagem: "Nao foi possivel falar com o servidor." };
  }
  const body = (await res.json().catch(() => ({}))) as Partial<Session> & { mensagem?: string };
  if (!res.ok || !body.token || !body.usuario || !body.expiraEm) {
    return { ok: false, mensagem: body.mensagem ?? (res.status === 429 ? "Muitas tentativas. Aguarde 1 minuto." : "Usuario ou senha invalidos.") };
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: body.token, usuario: body.usuario, expiraEm: body.expiraEm }));
  return { ok: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() =>
    usingMock ? (localStorage.getItem(MOCK_KEY) === "1" ? { token: "mock", usuario: MOCK_USER, expiraEm: "2999-01-01" } : null) : readSession(),
  );

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(MOCK_KEY);
    setSession(null);
  }, []);

  const login = useCallback(async (user: string, pass: string): Promise<LoginResult> => {
    if (usingMock) {
      const ok = user === MOCK_USER && pass === MOCK_PASS;
      if (!ok) return { ok: false, mensagem: "Usuario ou senha invalidos." };
      localStorage.setItem(MOCK_KEY, "1");
      setSession({ token: "mock", usuario: user, expiraEm: "2999-01-01" });
      return { ok: true };
    }
    const r = await loginHttp(user, pass);
    if (r.ok) setSession(readSession());
    return r;
  }, []);

  // 401 do backend (sessao expirada/invalida) -> volta para o login.
  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  const value = useMemo<AuthValue>(
    () => ({ authenticated: session !== null, usuario: session?.usuario ?? null, login, logout }),
    [session, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
