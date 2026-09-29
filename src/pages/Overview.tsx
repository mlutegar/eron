import { PipelineFlow } from "../components/PipelineFlow";
import { StatCard } from "../components/StatCard";
import { HealthDot } from "../components/StatusBadge";
import { DataTable, type Column } from "../components/DataTable";
import { Loading, ErrorState } from "../components/Loading";
import { useAsync } from "../lib/useAsync";
import { getOverview } from "../api/client";
import { brl, dateTime } from "../lib/format";
import type { SyncLogEntry } from "../types/api";
import { StatusBadge } from "../components/StatusBadge";

const cols: Column<SyncLogEntry>[] = [
  { key: "hora", header: "Quando", cell: (r) => dateTime(r.timestamp), mono: true },
  { key: "cliente", header: "Cliente", cell: (r) => r.boleto.cliente },
  { key: "valor", header: "Valor", cell: (r) => brl(r.boleto.valor), align: "right", mono: true },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
];

export function Overview() {
  const { data, loading, error } = useAsync(getOverview);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Sem dados."} />;

  const { counts, health, ultimos } = data;

  return (
    <div className="space-y-6">
      <PipelineFlow health={health} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sincronizados hoje" value={String(counts.hoje)} accent />
        <StatCard label="Nesta semana" value={String(counts.semana)} />
        <StatCard label="No mes" value={String(counts.mes)} hint={`${brl(counts.valorMes)} em boletos`} />
        <StatCard
          label="Em quarentena"
          value={String(counts.emQuarentena)}
          hint={counts.emQuarentena > 0 ? "precisam de atencao" : "tudo certo"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-display text-lg font-semibold">Ultimas sincronizacoes</h2>
          <DataTable
            columns={cols}
            rows={ultimos}
            rowKey={(r) => r.id}
            empty="Nenhuma sincronizacao registrada ainda."
          />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold">Saude do sistema</h2>
          <ul className="hairline space-y-3 rounded-xl bg-ink-800 p-4">
            {health.servicos.map((s) => (
              <li key={s.chave} className="flex items-start gap-3">
                <span className="mt-1.5">
                  <HealthDot state={s.estado} />
                </span>
                <div>
                  <div className="text-sm text-fg">{s.nome}</div>
                  <div className="text-xs text-fg-muted">{s.detalhe}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
