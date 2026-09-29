import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// Autenticacao da FASE MOCK: valida contra credenciais de ambiente e guarda
// um flag em localStorage. No go-live isto vira sessao real emitida pelo backend.

const STORAGE_KEY = "iazan.auth";
const USER = import.meta.env.VITE_LOGIN_USER ?? "admin";
const PASS = import.meta.env.VITE_LOGIN_PASS ?? "iazan";

interface AuthValue {
  authenticated: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(
    () => localStorage.getItem(STORAGE_KEY) === "1",
  );

  const login = useCallback((user: string, pass: string) => {
    const ok = user === USER && pass === PASS;
    if (ok) {
      localStorage.setItem(STORAGE_KEY, "1");
      setAuthenticated(true);
    }
    return ok;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthenticated(false);
  }, []);

  const value = useMemo(() => ({ authenticated, login, logout }), [authenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
