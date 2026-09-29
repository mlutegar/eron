import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { Loading, ErrorState } from "../components/Loading";
import { useAsync } from "../lib/useAsync";
import { getSyncLogs } from "../api/client";
import { brl, dateTime } from "../lib/format";
import type { SyncLogEntry, SyncStatus } from "../types/api";

const filters: { value: SyncStatus | "TODOS"; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "SINCRONIZADO", label: "Sincronizados" },
  { value: "REGISTRADO", label: "Aguardando" },
  { value: "QUARENTENA", label: "Quarentena" },
  { value: "ERRO", label: "Erros" },
];

const cols: Column<SyncLogEntry>[] = [
  { key: "hora", header: "Quando", cell: (r) => dateTime(r.timestamp), mono: true },
  { key: "venda", header: "Venda CA", cell: (r) => `#${r.boleto.vendaId}`, mono: true },
  { key: "cliente", header: "Cliente", cell: (r) => r.boleto.cliente },
  { key: "cnpj", header: "CNPJ", cell: (r) => r.boleto.cnpj, mono: true },
  {
    key: "zen",
    header: "Doc Zen",
    cell: (r) => r.boleto.documentoZenId ?? "—",
    mono: true,
  },
  { key: "valor", header: "Valor", cell: (r) => brl(r.boleto.valor), align: "right", mono: true },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

export function SyncLog() {
  const { data, loading, error } = useAsync(getSyncLogs);
  const [filter, setFilter] = useState<SyncStatus | "TODOS">("TODOS");
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      const matchStatus = filter === "TODOS" || r.status === filter;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        r.boleto.cliente.toLowerCase().includes(q) ||
        r.boleto.cnpj.includes(q) ||
        String(r.boleto.vendaId).includes(q);
      return matchStatus && matchQuery;
    });
  }, [data, filter, query]);

  return (
    <div>
      <PageHeader
        title="Log de sincronizacao"
        subtitle="Cada tentativa de publicar um boleto no Zen, com resultado e detalhe."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                filter === f.value
                  ? "border-flow/40 bg-flow/10 text-flow"
                  : "border-line text-fg-muted hover:text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por cliente, CNPJ ou venda"
          className="ml-auto w-full max-w-xs rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-flow/50"
        />
      </div>

      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? "Sem dados."} />
      ) : (
        <>
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(r) => r.id}
            empty="Nenhum registro para este filtro."
          />
          {rows.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-xs text-fg-muted">
              {rows.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <span className="font-mono text-fg-faint">{r.id}</span> · {r.mensagem}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
