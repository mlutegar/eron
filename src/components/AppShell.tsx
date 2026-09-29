import { NavLink, Outlet } from "react-router-dom";

const nav = [
  { to: "/", label: "Painel", end: true },
  { to: "/log", label: "Log de sincronizacao" },
  { to: "/quarentena", label: "Quarentena" },
  { to: "/clientes", label: "Mapeamento de clientes" },
  { to: "/status", label: "Status do sistema" },
];

export function AppShell() {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-ink-800 md:flex md:flex-col">
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
                `block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-flow/10 text-flow"
                    : "text-fg-muted hover:bg-ink-700 hover:text-fg"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-5 text-xs text-fg-faint">
          ASSEJURC · homologacao
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
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="h-2 w-2 rounded-full bg-flow animate-breathe" />
            Serviço ativo
          </div>
        </header>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
