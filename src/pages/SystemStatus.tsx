import { PageHeader } from "../components/PageHeader";
import { HealthDot } from "../components/StatusBadge";
import { Loading, ErrorState } from "../components/Loading";
import { useAsync } from "../lib/useAsync";
import { getHealth } from "../api/client";
import { dateTime } from "../lib/format";
import type { HealthState } from "../types/api";

const stateLabel: Record<HealthState, string> = {
  OK: "Operacional",
  ATENCAO: "Atencao",
  FALHA: "Falha",
};

export function SystemStatus() {
  const { data, loading, error, refetch } = useAsync(getHealth, [], { refreshMs: 60_000 });

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorState message={error ?? "Sem dados."} onRetry={refetch} />;

  const geral: HealthState = data.servicos.some((s) => s.estado === "FALHA")
    ? "FALHA"
    : data.servicos.some((s) => s.estado === "ATENCAO")
      ? "ATENCAO"
      : "OK";

  return (
    <div>
      <PageHeader
        title="Status do sistema"
        subtitle="Saude dos componentes da integracao e janela de sincronizacao."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="hairline rounded-xl bg-ink-800 p-5">
          <div className="text-xs uppercase tracking-wider text-fg-faint">Estado geral</div>
          <div className="mt-2 flex items-center gap-2">
            <HealthDot state={geral} />
            <span className="font-display text-lg">{stateLabel[geral]}</span>
          </div>
        </div>
        <div className="hairline rounded-xl bg-ink-800 p-5">
          <div className="text-xs uppercase tracking-wider text-fg-faint">Ultima sync</div>
          <div className="mt-2 font-display text-lg tnum">{dateTime(data.ultimaSync)}</div>
        </div>
        <div className="hairline rounded-xl bg-ink-800 p-5">
          <div className="text-xs uppercase tracking-wider text-fg-faint">Proxima sync</div>
          <div className="mt-2 font-display text-lg tnum">{dateTime(data.proximaSync)}</div>
          <div className="mt-0.5 text-xs text-fg-muted">a cada {data.intervaloMin} minutos</div>
        </div>
      </div>

      <ul className="hairline divide-y divide-line rounded-xl bg-ink-800">
        {data.servicos.map((s) => (
          <li key={s.chave} className="flex items-center gap-4 px-5 py-4">
            <HealthDot state={s.estado} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-fg">{s.nome}</div>
              <div className="text-xs text-fg-muted">{s.detalhe}</div>
            </div>
            <span
              className={`text-xs font-medium ${
                s.estado === "OK"
                  ? "text-flow"
                  : s.estado === "ATENCAO"
                    ? "text-warn"
                    : "text-danger"
              }`}
            >
              {stateLabel[s.estado]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
