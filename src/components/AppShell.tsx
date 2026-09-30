import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { getQuarantine, publishingSimulated } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeContext";
import { BottomNav } from "./BottomNav";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive ? "bg-flow/10 text-flow" : "text-fg-muted hover:bg-ink-700 hover:text-fg"
  }`;

const nav = [
  { to: "/", label: "Envio de boletos", end: true },
  { to: "/log", label: "Log de sincronizacao" },
  { to: "/quarentena", label: "Quarentena", badge: true },
  { to: "/clientes", label: "Mapeamento de clientes" },
  { to: "/status", label: "Status do sistema" },
];

function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={`grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-ink-700 hover:text-fg ${className}`}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function AppShell() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  // Contagem para o badge; atualiza a cada 60s.
  const { data: quarantine } = useAsync(getQuarantine, [], { refreshMs: 60_000 });
  const qCount = quarantine?.length ?? 0;
  const [menuOpen, setMenuOpen] = useState(false);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Drawer: fecha com Esc, trava scroll do body e foca o primeiro link.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    firstLinkRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
      {/* Drawer de navegacao no mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col border-r border-line bg-ink-800">
            <div className="flex items-center justify-between px-6 py-6">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-flow/15 font-display text-flow">
                  IZ
                </span>
                <div>
                  <div className="font-display text-sm font-semibold leading-tight">IAZAN Sync</div>
                  <div className="text-xs text-fg-faint">Conta Azul → Zen</div>
                </div>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Fechar menu"
                className="text-fg-muted hover:text-fg"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 space-y-1 px-3 py-2">
              {nav.map((item, i) => (
                <NavLink
                  key={item.to}
                  ref={i === 0 ? firstLinkRef : undefined}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMenuOpen(false)}
                  className={navLinkClass}
                >
                  <span>{item.label}</span>
                  {item.badge && qCount > 0 && (
                    <span className="rounded-full bg-warn/20 px-1.5 py-0.5 text-xs font-medium text-warn">
                      {qCount}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>
            <div className="flex items-center justify-between px-6 py-5">
              <div className="space-y-2">
                <div className="text-xs text-fg-faint">ASSEJURC · homologacao</div>
                <button onClick={handleLogout} className="text-xs text-fg-muted hover:text-fg">
                  Sair
                </button>
              </div>
              <ThemeToggle />
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-ink-800 md:flex">
        <div className="flex items-center gap-2.5 px-6 py-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-flow/15 font-display text-flow">
            IZ
          </span>
          <div>
            <div className="font-display text-sm font-semibold leading-tight">IAZAN Sync</div>
            <div className="text-xs text-fg-faint">Conta Azul → Zen</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              <span>{item.label}</span>
              {item.badge && qCount > 0 && (
                <span className="rounded-full bg-warn/20 px-1.5 py-0.5 text-xs font-medium text-warn">
                  {qCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between px-6 py-5">
          <div className="space-y-2">
            <div className="text-xs text-fg-faint">ASSEJURC · homologacao</div>
            <button onClick={handleLogout} className="text-xs text-fg-muted hover:text-fg">
              Sair
            </button>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-ink-900/80 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              className="grid h-8 w-8 place-items-center rounded-md text-fg-muted hover:bg-ink-700 hover:text-fg"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className="grid h-7 w-7 place-items-center rounded-md bg-flow/15 font-display text-sm text-flow">
              IZ
            </span>
            <span className="font-display text-sm font-semibold">IAZAN Sync</span>
          </div>
          <div className="hidden text-sm text-fg-muted md:block">
            Painel operacional da integracao de boletos
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <span className="flex items-center gap-2" aria-live="polite">
              <span
                className={`h-2 w-2 rounded-full ${publishingSimulated ? "bg-warn" : "animate-breathe bg-flow"}`}
                aria-hidden
              />
              {publishingSimulated ? "Modo demonstracao" : "Sistema no ar"}
            </span>
            <ThemeToggle className="hidden md:grid" />
            <button onClick={handleLogout} className="hover:text-fg md:hidden">
              Sair
            </button>
          </div>
        </header>

        {publishingSimulated && (
          <div role="status" className="border-b border-warn/30 bg-warn/10 px-5 py-3 text-sm text-warn md:px-8">
            Dados de demonstracao. O botao Enviar agora so simula; nenhum boleto e enviado ao Questor Zen.
          </div>
        )}

        <main className="flex-1 px-5 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
          <Outlet />
        </main>
      </div>

      <BottomNav qCount={qCount} />
    </div>
  );
}
