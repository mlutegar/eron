import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type Column } from "../components/DataTable";
import { BoletoDrawer } from "../components/BoletoDrawer";
import { useToast } from "../components/Toast";
import { useAsync } from "../lib/useAsync";
import { getLastRun, getPending, getSettings, runSync, setSettings } from "../api/client";
import { brl, dateTime } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import type { Boleto, RunItem, RunResult } from "../types/api";

const cols: Column<RunItem>[] = [
  { key: "cliente", header: "Cliente", cell: (r) => r.boleto.cliente },
  { key: "valor", header: "Valor", cell: (r) => brl(r.boleto.valor), align: "right", mono: true },
  { key: "resultado", header: "Resultado", cell: (r) => <ResultBadge ok={r.ok} /> },
  { key: "mensagem", header: "Detalhe", cell: (r) => r.mensagem },
];

function ResultBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        ok ? "border-flow/30 bg-flow/10 text-flow" : "border-danger/30 bg-danger/10 text-danger"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {ok ? "Subiu" : "Nao subiu"}
    </span>
  );
}

/** Detecta erro de sessao/2FA da Conta Azul para orientar o operador. */
function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/CA_NAO_CONECTADA|503|consentimento|sess[aã]o/i.test(msg)) {
    return "Sessao da Conta Azul expirada. Peca o codigo do banco ao cliente e refaca o consentimento.";
  }
  if (/EXECUCAO_EM_ANDAMENTO|409/i.test(msg)) {
    return "Ja existe uma execucao em andamento. Aguarde terminar.";
  }
  return msg || "Falha ao executar o robo.";
}

export function Activate() {
  const { data: pendentes } = useAsync(getPending, []);
  const { data: lastRun } = useAsync(getLastRun, []);
  const { toast } = useToast();

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [visibleCount, setVisibleCount] = useState(0); // revelacao progressiva (log "ao vivo")
  const [selected, setSelected] = useState<Boleto | null>(null);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [autoRun, setAutoRun] = useState(false);

  // Mostra a ultima execucao ao abrir a tela (sem precisar rodar de novo).
  useEffect(() => {
    if (lastRun && !result) setResult(lastRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRun]);

  useEffect(() => {
    getSettings().then((s) => setAutoRun(s.autoRun)).catch(() => {});
  }, []);

  // Revela as linhas do resultado uma a uma, dando a sensacao de "ao vivo".
  useEffect(() => {
    if (!result) return;
    if (visibleCount >= result.itens.length) return;
    const id = setTimeout(() => setVisibleCount((n) => n + 1), 120);
    return () => clearTimeout(id);
  }, [result, visibleCount]);

  async function handleRun() {
    if (running) return; // trava contra clique duplo
    const total = pendentes?.length ?? 0;
    if (total > 0 && !window.confirm(`Ligar o robo e processar ${total} boleto(s) pendente(s)?`)) {
      return;
    }
    setRunning(true);
    setProgress({ done: 0, total });
    setResult(null);
    setVisibleCount(0);
    try {
      const r = await runSync();
      setResult(r);
      setVisibleCount(0);
      toast(
        r.naoSubiram === 0
          ? `Tudo certo: ${r.subiram} boleto(s) publicado(s) — ${brl(r.valorPublicado)}.`
          : `${r.subiram} subiram, ${r.naoSubiram} nao subiram. Veja o log abaixo.`,
        r.naoSubiram === 0 ? "success" : "info",
      );
    } catch (e) {
      toast(friendlyError(e), "error");
    } finally {
      setRunning(false);
      setProgress(null);
    }
  }

  async function toggleAuto() {
    const next = !autoRun;
    setAutoRun(next);
    try {
      const s = await setSettings({ autoRun: next });
      setAutoRun(s.autoRun);
      toast(s.autoRun ? "Modo automatico ligado." : "Modo automatico desligado.", "info");
    } catch (e) {
      setAutoRun(!next);
      toast(friendlyError(e), "error");
    }
  }

  const falhas = useMemo(() => result?.itens.filter((i) => !i.ok) ?? [], [result]);

  // Agrupa as falhas por motivo (facilita agir em lote).
  const gruposFalha = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of falhas) m.set(f.mensagem, (m.get(f.mensagem) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [falhas]);

  const rows = useMemo(() => {
    const base = onlyFailed ? falhas : (result?.itens ?? []);
    // Durante a revelacao progressiva, corta pela contagem visivel.
    return onlyFailed ? base : base.slice(0, visibleCount || base.length);
  }, [onlyFailed, falhas, result, visibleCount]);

  function exportFailuresCsv() {
    downloadCsv(
      "boletos-nao-subiram.csv",
      ["Venda", "Cliente", "CNPJ", "Valor", "Motivo"],
      falhas.map((f) => [
        String(f.boleto.vendaId),
        f.boleto.cliente,
        f.boleto.cnpj,
        brl(f.boleto.valor),
        f.mensagem,
      ]),
    );
  }

  function reprocessFailures() {
    // Reexecuta: como o robo e idempotente, so os pendentes (falhas) sobem.
    void handleRun();
  }

  const pendingCount = pendentes?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Ativador */}
      <section className="hairline rounded-2xl bg-ink-800 px-6 py-10 text-center">
        <div className="mb-2 text-xs font-medium uppercase tracking-widest text-fg-faint">
          {running ? "Processando…" : "Robo pronto"}
        </div>
        <h1 className="font-display text-2xl font-semibold text-fg">
          Publicar boletos no Questor Zen
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          {running
            ? progress
              ? `Enviando ao e-Doc do Zen… (${progress.total} pendente(s))`
              : "Varrendo os boletos pendentes…"
            : pendingCount > 0
              ? `${pendingCount} boleto(s) pendente(s) para processar.`
              : "Nenhum boleto pendente no momento."}
        </p>

        <button
          onClick={handleRun}
          disabled={running}
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-flow/40 bg-flow/15 px-8 py-3 font-display text-base font-semibold text-flow transition-transform hover:bg-flow/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? (
            <>
              <Spinner /> Processando…
            </>
          ) : (
            <>
              <PlayIcon /> Ativar
            </>
          )}
        </button>

        {/* Modo automatico */}
        <label className="mt-6 flex items-center justify-center gap-2 text-xs text-fg-muted">
          <input
            type="checkbox"
            checked={autoRun}
            onChange={toggleAuto}
            className="h-4 w-4 accent-flow"
          />
          Rodar automaticamente a cada janela do agendador
        </label>
      </section>

      {/* Resultado da execucao */}
      {result && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-semibold">Resultado</h2>
            <span className="text-sm text-flow">{result.subiram} subiram</span>
            {result.naoSubiram > 0 && (
              <span className="text-sm text-danger">{result.naoSubiram} nao subiram</span>
            )}
            <span className="text-sm text-fg-muted">{brl(result.valorPublicado)} publicado(s)</span>
            <span className="ml-auto text-xs text-fg-faint">
              Ultima execucao: {dateTime(result.executadoEm)}
            </span>
          </div>

          {/* Falhas agrupadas por motivo */}
          {gruposFalha.length > 0 && (
            <div className="hairline rounded-xl bg-ink-800 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-faint">
                Falhas por motivo
              </div>
              <ul className="space-y-1 text-sm">
                {gruposFalha.map(([motivo, n]) => (
                  <li key={motivo} className="flex items-center justify-between gap-4">
                    <span className="text-fg-muted">{motivo}</span>
                    <span className="font-mono text-danger">{n}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Acoes sobre o resultado */}
          <div className="flex flex-wrap items-center gap-2">
            {result.naoSubiram > 0 && (
              <>
                <button
                  onClick={reprocessFailures}
                  disabled={running}
                  className="rounded-lg border border-flow/40 px-3 py-1.5 text-sm text-flow hover:bg-flow/10 disabled:opacity-60"
                >
                  Tentar de novo os que falharam
                </button>
                <button
                  onClick={exportFailuresCsv}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
                >
                  Exportar falhas (CSV)
                </button>
                <label className="flex items-center gap-1.5 text-sm text-fg-muted">
                  <input
                    type="checkbox"
                    checked={onlyFailed}
                    onChange={(e) => setOnlyFailed(e.target.checked)}
                    className="h-4 w-4 accent-danger"
                  />
                  So falhas
                </label>
              </>
            )}
          </div>

          <DataTable
            columns={cols}
            rows={rows}
            rowKey={(r) => r.boleto.idCobranca}
            onRowClick={(r) => setSelected(r.boleto)}
            rowAccent={(r) => (r.ok ? "flow" : "danger")}
            empty="Nenhum boleto pendente para processar."
          />

          <div className="text-right">
            <Link to="/log" className="text-sm text-fg-muted underline hover:text-fg">
              Ver historico completo
            </Link>
          </div>
        </section>
      )}

      <BoletoDrawer boleto={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  );
}
