import type { ReactNode } from "react";

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
}

export function DataTable<T>({ columns, rows, rowKey, empty }: DataTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="hairline rounded-xl bg-ink-800 px-6 py-16 text-center text-fg-muted">
        {empty ?? "Nada por aqui."}
      </div>
    );
  }
  return (
    <div className="hairline overflow-x-auto rounded-xl bg-ink-800">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-fg-faint ${
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
              className="border-b border-line/60 last:border-0 transition-colors hover:bg-ink-700/50"
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
  );
}
