import { useEffect } from "react";
import type { Boleto } from "../types/api";
import { StatusBadge } from "./StatusBadge";
import { Loading } from "./Loading";
import { useAsync } from "../lib/useAsync";
import { getBoletoLogs } from "../api/client";
import { brl, dateOnly, dateTime } from "../lib/format";

interface Props {
  boleto: Boleto | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-xs uppercase tracking-wider text-fg-faint">{label}</span>
      <span className="text-right text-sm text-fg">{value}</span>
    </div>
  );
}

export function BoletoDrawer({ boleto, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (boleto) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [boleto, onClose]);

  const { data: logs, loading } = useAsync(
    () => (boleto ? getBoletoLogs(boleto.idCobranca) : Promise.resolve([])),
    [boleto?.idCobranca],
  );

  if (!boleto) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <aside className="relative h-full w-full max-w-md overflow-y-auto border-l border-line bg-ink-800 p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="font-mono text-xs text-fg-faint">Venda #{boleto.vendaId}</div>
            <h2 className="mt-1 font-display text-lg font-semibold">{boleto.cliente}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg border border-line px-2 py-1 text-fg-muted hover:text-fg"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <StatusBadge status={boleto.status} />
        </div>

        <div className="divide-y divide-line/60">
          <Row label="Valor" value={<span className="font-mono">{brl(boleto.valor)}</span>} />
          <Row label="Vencimento" value={dateOnly(boleto.vencimento)} />
          <Row label="CNPJ" value={<span className="font-mono">{boleto.cnpj}</span>} />
          <Row
            label="Empresa Zen"
            value={boleto.empresaZen ?? <span className="text-warn">nao mapeada</span>}
          />
          <Row
            label="ID cobranca (CA)"
            value={<span className="font-mono">{boleto.idCobranca}</span>}
          />
          <Row
            label="Doc e-Doc (Zen)"
            value={
              boleto.documentoZenId ? (
                <span className="font-mono text-flow">{boleto.documentoZenId}</span>
              ) : (
                "—"
              )
            }
          />
          <Row label="Emitido em" value={dateTime(boleto.emitidoEm)} />
          <Row
            label="Sincronizado em"
            value={boleto.sincronizadoEm ? dateTime(boleto.sincronizadoEm) : "—"}
          />
        </div>

        <a
          href={`https://public.contaazul.com/payments/billing/charge/file/${boleto.idCobranca}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 block rounded-lg border border-line bg-ink-900 px-4 py-2.5 text-center text-sm text-fg-muted hover:text-fg"
        >
          Abrir PDF do boleto ↗
        </a>

        <h3 className="mb-2 mt-6 font-display text-sm font-semibold">Historico de tentativas</h3>
        {loading ? (
          <Loading label="Carregando historico..." />
        ) : logs && logs.length > 0 ? (
          <ol className="space-y-2">
            {logs.map((l) => (
              <li key={l.id} className="hairline rounded-lg bg-ink-900 px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <StatusBadge status={l.status} />
                  <span className="font-mono text-fg-faint">{dateTime(l.timestamp)}</span>
                </div>
                <p className="mt-1.5 text-fg-muted">{l.mensagem}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-fg-muted">Sem tentativas registradas.</p>
        )}
      </aside>
    </div>
  );
}
