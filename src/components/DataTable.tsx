import type { ReactNode } from "react";
import { useMediaQuery } from "../lib/useMediaQuery";

export type Accent = "flow" | "warn" | "danger" | "muted";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
  mono?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Cor da borda esquerda do card no mobile (ex.: status do registro). */
  rowAccent?: (row: T) => Accent;
}

const accentBorder: Record<Accent, string> = {
  flow: "border-l-flow",
  warn: "border-l-warn",
  danger: "border-l-danger",
  muted: "border-l-line",
};

export function DataTable<T>({ columns, rows, rowKey, empty, onRowClick, rowAccent }: DataTableProps<T>) {
  // Renderiza só uma variante (evita conteúdo duplicado no DOM/leitor de tela).
  const isMobile = useMediaQuery("(max-width: 767px)");

  if (rows.length === 0) {
    return (
      <div className="hairline rounded-xl bg-ink-800 px-6 py-16 text-center text-fg-muted">
        {empty ?? "Nada por aqui."}
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter") onRowClick(row);
                  }
                : undefined
            }
            className={`hairline space-y-2 rounded-xl bg-ink-800 p-4 transition-colors ${
              rowAccent ? `border-l-4 ${accentBorder[rowAccent(row)]}` : ""
            } ${onRowClick ? "cursor-pointer hover:bg-ink-700/50" : ""}`}
          >
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium uppercase tracking-wider text-fg-faint">
                  {c.header}
                </span>
                <span
                  className={`text-right text-sm ${
                    c.mono ? "font-mono text-[13px] text-fg-muted tnum" : "text-fg"
                  }`}
                >
                  {c.cell(row)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Desktop: tabela tradicional */}
      <div className="hairline overflow-x-auto rounded-xl bg-ink-800">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`sticky top-0 z-10 bg-ink-800 px-4 py-3 text-xs font-medium uppercase tracking-wider text-fg-faint ${
                    c.align === "right" ? "text-right" : ""
                  }`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter") onRowClick(row);
                      }
                    : undefined
                }
                className={`border-b border-line/60 last:border-0 transition-colors hover:bg-ink-700/50 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-4 py-3 align-middle ${
                      c.align === "right" ? "text-right" : ""
                    } ${c.mono ? "font-mono text-[13px] text-fg-muted tnum" : "text-fg"}`}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
