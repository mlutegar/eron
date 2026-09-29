import { useMemo, useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge } from "../components/StatusBadge";
import { Loading, ErrorState } from "../components/Loading";
import { BoletoDrawer } from "../components/BoletoDrawer";
import { useAsync } from "../lib/useAsync";
import { getSyncLogs } from "../api/client";
import { brl, dateOnly, dateTime } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import type { Boleto, SyncLogEntry, SyncStatus } from "../types/api";

const filters: { value: SyncStatus | "TODOS"; label: string }[] = [
  { value: "TODOS", label: "Todos" },
  { value: "SINCRONIZADO", label: "Sincronizados" },
  { value: "REGISTRADO", label: "Aguardando" },
  { value: "QUARENTENA", label: "Quarentena" },
  { value: "ERRO", label: "Erros" },
];

const periods: { value: string; label: string; days: number | null }[] = [
  { value: "all", label: "Todo periodo", days: null },
  { value: "7", label: "7 dias", days: 7 },
  { value: "30", label: "30 dias", days: 30 },
];

const PAGE_SIZE = 5;

const cols: Column<SyncLogEntry>[] = [
  { key: "hora", header: "Quando", cell: (r) => dateTime(r.timestamp), mono: true },
  { key: "venda", header: "Venda CA", cell: (r) => `#${r.boleto.vendaId}`, mono: true },
  { key: "cliente", header: "Cliente", cell: (r) => r.boleto.cliente },
  { key: "cnpj", header: "CNPJ", cell: (r) => r.boleto.cnpj, mono: true },
  { key: "zen", header: "Doc Zen", cell: (r) => r.boleto.documentoZenId ?? "—", mono: true },
  { key: "valor", header: "Valor", cell: (r) => brl(r.boleto.valor), align: "right", mono: true },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

export function SyncLog() {
  const { data, loading, error, refetch } = useAsync(getSyncLogs);
  const [filter, setFilter] = useState<SyncStatus | "TODOS">("TODOS");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Boleto | null>(null);

  const filtered = useMemo(() => {
    if (!data) return [];
    const days = periods.find((p) => p.value === period)?.days ?? null;
    const cutoff = days ? Date.now() - days * 86_400_000 : null;
    return data.filter((r) => {
      const matchStatus = filter === "TODOS" || r.status === filter;
      const matchPeriod = !cutoff || new Date(r.timestamp).getTime() >= cutoff;
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        r.boleto.cliente.toLowerCase().includes(q) ||
        r.boleto.cnpj.includes(q) ||
        String(r.boleto.vendaId).includes(q);
      return matchStatus && matchPeriod && matchQuery;
    });
  }, [data, filter, period, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  function exportCsv() {
    downloadCsv(
      "log-sincronizacao.csv",
      ["Quando", "Venda", "Cliente", "CNPJ", "Doc Zen", "Valor", "Status", "Mensagem"],
      filtered.map((r) => [
        dateTime(r.timestamp),
        String(r.boleto.vendaId),
        r.boleto.cliente,
        r.boleto.cnpj,
        r.boleto.documentoZenId ?? "",
        brl(r.boleto.valor),
        r.status,
        r.mensagem,
      ]),
    );
  }

  return (
    <div>
      <PageHeader
        title="Log de sincronizacao"
        subtitle="Cada tentativa de publicar um boleto no Zen. Clique numa linha para ver detalhes."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => resetPage(setFilter)(f.value)}
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
        <div className="flex gap-1.5">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => resetPage(setPeriod)(p.value)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                period === p.value
                  ? "border-fg-muted/50 bg-ink-700 text-fg"
                  : "border-line text-fg-muted hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => resetPage(setQuery)(e.target.value)}
          placeholder="Buscar por cliente, CNPJ ou venda"
          className="w-full max-w-xs rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-flow/50"
        />
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="ml-auto rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-40"
        >
          Exportar CSV
        </button>
      </div>

      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? "Sem dados."} onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(r.boleto)}
            empty="Nenhum registro para este filtro."
          />
          <div className="mt-3 flex items-center justify-between text-xs text-fg-muted">
            <span>
              {filtered.length} registro(s)
              {period !== "all" && ` · ${periods.find((p) => p.value === period)?.label}`}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="rounded border border-line px-2 py-1 hover:text-fg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span>
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="rounded border border-line px-2 py-1 hover:text-fg disabled:opacity-40"
                >
                  Proxima
                </button>
              </div>
            )}
          </div>
          {rows.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-xs text-fg-muted">
              {rows.slice(0, 3).map((r) => (
                <li key={r.id}>
                  <span className="font-mono text-fg-faint">{dateOnly(r.timestamp)}</span> ·{" "}
                  {r.mensagem}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <BoletoDrawer boleto={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
