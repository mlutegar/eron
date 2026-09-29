import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { DataTable, type Column } from "../components/DataTable";
import { StatusBadge, statusAccent } from "../components/StatusBadge";
import { ErrorState } from "../components/Loading";
import { TableSkeleton } from "../components/Skeleton";
import { BoletoDrawer } from "../components/BoletoDrawer";
import { useToast } from "../components/Toast";
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
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<Boleto | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Estado derivado da URL (compartilhável / preserva ao voltar).
  const filter = (params.get("status") as SyncStatus | "TODOS") || "TODOS";
  const period = params.get("period") || "all";
  const query = params.get("q") || "";
  const page = Number(params.get("page") || 0);

  function patch(next: Record<string, string | null>, resetPage = true) {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "" || v === "TODOS" || v === "all") p.delete(k);
      else p.set(k, v);
    }
    if (resetPage) p.delete("page");
    setParams(p, { replace: true });
  }

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

  // Trava o scroll do body quando o bottom sheet está aberto.
  useEffect(() => {
    if (!sheetOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  const activeFilters =
    (filter !== "TODOS" ? 1 : 0) + (period !== "all" ? 1 : 0) + (query.trim() ? 1 : 0);

  function exportCsv() {
    if (filtered.length === 0) return;
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
    toast(`${filtered.length} registro(s) exportado(s) em CSV`, "success");
  }

  // Grupos de filtros reutilizados no desktop e no bottom sheet.
  const filterControls = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => patch({ status: f.value })}
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
            onClick={() => patch({ period: p.value })}
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
    </>
  );

  return (
    <div>
      <PageHeader
        title="Log de sincronizacao"
        subtitle="Cada tentativa de publicar um boleto no Zen. Clique numa linha para ver detalhes."
      />

      {/* Barra desktop */}
      <div className="mb-4 hidden flex-wrap items-center gap-3 sm:flex">
        {filterControls}
        <input
          value={query}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Buscar por cliente, CNPJ ou venda"
          className="w-full rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-flow/50 sm:max-w-xs"
        />
        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted hover:text-fg disabled:opacity-40 sm:ml-auto"
        >
          Exportar CSV
        </button>
      </div>

      {/* Barra mobile: busca + botão de filtros */}
      <div className="mb-4 flex items-center gap-2 sm:hidden">
        <input
          value={query}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Filtrar cliente, CNPJ ou venda"
          className="min-w-0 flex-1 rounded-lg border border-line bg-ink-800 px-3 py-1.5 text-sm text-fg placeholder:text-fg-faint focus:border-flow/50"
        />
        <button
          onClick={() => setSheetOpen(true)}
          className="relative shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
        >
          Filtros
          {activeFilters > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-flow text-[10px] font-semibold text-ink-900">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <TableSkeleton rows={PAGE_SIZE} />
      ) : error || !data ? (
        <ErrorState message={error ?? "Sem dados."} onRetry={refetch} />
      ) : (
        <>
          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(r) => r.id}
            onRowClick={(r) => setSelected(r.boleto)}
            rowAccent={(r) => statusAccent[r.status]}
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
                  onClick={() => patch({ page: String(Math.max(0, safePage - 1)) }, false)}
                  disabled={safePage === 0}
                  className="rounded border border-line px-2 py-1 hover:text-fg disabled:opacity-40"
                >
                  Anterior
                </button>
                <span>
                  {safePage + 1} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    patch({ page: String(Math.min(totalPages - 1, safePage + 1)) }, false)
                  }
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

      {/* Bottom sheet de filtros (mobile) */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Filtros">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSheetOpen(false)} aria-hidden />
          <div className="absolute inset-x-0 bottom-0 space-y-4 rounded-t-2xl border-t border-line bg-ink-800 p-5 pb-8">
            <div className="mx-auto h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Filtros</h3>
              <button
                onClick={() => patch({ status: null, period: null, q: null })}
                className="text-xs text-fg-muted hover:text-fg"
              >
                Limpar
              </button>
            </div>
            <div className="space-y-4">{filterControls}</div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm text-fg-muted hover:text-fg disabled:opacity-40"
              >
                Exportar CSV
              </button>
              <button
                onClick={() => setSheetOpen(false)}
                className="flex-1 rounded-lg border border-flow/40 bg-flow/10 px-3 py-2 text-sm font-medium text-flow"
              >
                Ver {filtered.length} resultado(s)
              </button>
            </div>
          </div>
        </div>
      )}

      <BoletoDrawer boleto={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
