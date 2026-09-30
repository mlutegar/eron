import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

interface Item {
  to: string;
  label: string;
  end?: boolean;
  badge?: boolean;
  icon: ReactNode;
}

const icon = (path: ReactNode) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);

const items: Item[] = [
  { to: "/", label: "Envio de boletos", end: true, icon: icon(<><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></>) },
  { to: "/log", label: "Log", icon: icon(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>) },
  { to: "/quarentena", label: "Quarentena", badge: true, icon: icon(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>) },
  { to: "/clientes", label: "Clientes", icon: icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>) },
  { to: "/status", label: "Status", icon: icon(<><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>) },
];

export function BottomNav({ qCount }: { qCount: number }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-ink-800/95 backdrop-blur md:hidden"
      aria-label="Navegação principal"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive ? "text-flow" : "text-fg-muted"
            }`
          }
        >
          <span className="relative">
            {item.icon}
            {item.badge && qCount > 0 && (
              <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-warn px-1 text-[9px] font-semibold leading-4 text-[#14161B]">
                {qCount}
              </span>
            )}
          </span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
