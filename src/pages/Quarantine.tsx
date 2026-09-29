import { useState } from "react";
import { PageHeader } from "../components/PageHeader";
import { Loading, ErrorState } from "../components/Loading";
import { useAsync } from "../lib/useAsync";
import { getQuarantine, reprocess } from "../api/client";
import { brl, dateTime } from "../lib/format";
import type { QuarantineItem } from "../types/api";

export function Quarantine() {
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useAsync(getQuarantine, [reload]);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleReprocess(id: string) {
    setBusy(id);
    await reprocess(id);
    setBusy(null);
    setReload((n) => n + 1);
  }

  return (
    <div>
      <PageHeader
        title="Quarentena"
        subtitle="Boletos que nao puderam ser publicados automaticamente e precisam de intervencao."
      />

      {loading ? (
        <Loading />
      ) : error || !data ? (
        <ErrorState message={error ?? "Sem dados."} />
      ) : data.length === 0 ? (
        <div className="hairline rounded-xl border-flow/20 bg-flow/5 px-6 py-16 text-center">
          <div className="font-display text-lg text-flow">Nenhum boleto em quarentena</div>
          <p className="mt-1 text-sm text-fg-muted">Tudo sincronizado. Nada exige acao agora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((q: QuarantineItem) => (
            <div
              key={q.id}
              className="hairline flex flex-col gap-4 rounded-xl bg-ink-800 p-5 md:flex-row md:items-center md:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">
                    {q.motivo}
                  </span>
                  <span className="font-mono text-xs text-fg-faint">Venda #{q.boleto.vendaId}</span>
                </div>
                <div className="mt-2 font-display text-base text-fg">{q.boleto.cliente}</div>
                <div className="mt-0.5 text-sm text-fg-muted">
                  <span className="font-mono">{q.boleto.cnpj}</span> · {brl(q.boleto.valor)} · em
                  quarentena desde {dateTime(q.desde)}
                </div>
              </div>
              <button
                onClick={() => handleReprocess(q.id)}
                disabled={busy === q.id}
                className="shrink-0 rounded-lg border border-flow/40 bg-flow/10 px-4 py-2 text-sm font-medium text-flow transition-colors hover:bg-flow/20 disabled:opacity-50"
              >
                {busy === q.id ? "Reprocessando..." : "Reprocessar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
