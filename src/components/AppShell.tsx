import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAsync } from "../lib/useAsync";
import { getQuarantine } from "../api/client";
import { useAuth } from "../auth/AuthContext";

const nav = [
  { to: "/", label: "Painel", end: true },
  { to: "/log", label: "Log de sincronizacao" },
  { to: "/quarentena", label: "Quarentena", badge: true },
  { to: "/clientes", label: "Mapeamento de clientes" },
  { to: "/status", label: "Status do sistema" },
];

export function AppShell() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  // Contagem para o badge; atualiza a cada 60s.
  const { data: quarantine } = useAsync(getQuarantine, [], { refreshMs: 60_000 });
  const qCount = quarantine?.length ?? 0;

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen">
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
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-flow/10 text-flow" : "text-fg-muted hover:bg-ink-700 hover:text-fg"
                }`
              }
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
        <div className="space-y-2 px-6 py-5">
          <div className="text-xs text-fg-faint">ASSEJURC · homologacao</div>
          <button onClick={handleLogout} className="text-xs text-fg-muted hover:text-fg">
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-ink-900/80 px-5 py-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-2 md:hidden">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-flow/15 font-display text-sm text-flow">
              IZ
            </span>
            <span className="font-display text-sm font-semibold">IAZAN Sync</span>
          </div>
          <div className="hidden text-sm text-fg-muted md:block">
            Painel operacional da integracao de boletos
          </div>
          <div className="flex items-center gap-3 text-xs text-fg-muted">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-breathe rounded-full bg-flow" />
              Servico ativo
            </span>
            <button onClick={handleLogout} className="hover:text-fg md:hidden">
              Sair
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
