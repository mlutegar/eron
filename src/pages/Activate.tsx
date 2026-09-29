import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, type Column } from "../components/DataTable";
import { BoletoDrawer } from "../components/BoletoDrawer";
import { useToast } from "../components/Toast";
import { useAsync } from "../lib/useAsync";
import { getLastRun, getPending, getSettings, publishingSimulated, runSync, setSettings } from "../api/client";
import { brl, dateOnly, dateTime } from "../lib/format";
import { downloadCsv } from "../lib/csv";
import type { Boleto, RunItem, RunResult, Settings } from "../types/api";

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

/** Traduz os codigos do backend em orientacao para o operador. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ENVIO_DESABILITADO/.test(msg)) {
    return "O envio ao Zen esta desabilitado. Ligue a chave geral nos controles do robo para publicar.";
  }
  if (/SEM_DATA_CORTE/.test(msg)) {
    return "Defina a data de corte antes de publicar (so boletos emitidos a partir dela entram).";
  }
  if (/ZEN_NAO_CONFIGURADO/.test(msg)) {
    return "O Questor Zen ainda nao esta configurado neste servidor. Nenhum documento foi publicado.";
  }
  if (/FORA_DO_HORARIO/.test(msg)) {
    return "Fora do horario de entrega (7h as 19h).";
  }
  if (/CA_NAO_CONECTADA|consentimento|sess[aã]o/i.test(msg)) {
    return "Sessao da Conta Azul expirada. Peca o codigo do banco ao cliente e refaca o consentimento.";
  }
  if (/EXECUCAO_EM_ANDAMENTO|409/i.test(msg)) {
    return "Ja existe uma execucao em andamento. Aguarde terminar.";
  }
  return msg || "Falha ao executar o robo.";
}

/** Data de hoje no formato AAAA-MM-DD (para o padrao da data de corte). */
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [settings, setSettingsState] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Mostra a ultima execucao ao abrir a tela (sem precisar rodar de novo).
  useEffect(() => {
    if (lastRun && !result) setResult(lastRun);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRun]);

  useEffect(() => {
    getSettings().then(setSettingsState).catch(() => {});
  }, []);

  // Revela as linhas do resultado uma a uma, dando a sensacao de "ao vivo".
  useEffect(() => {
    if (!result) return;
    if (visibleCount >= result.itens.length) return;
    const id = setTimeout(() => setVisibleCount((n) => n + 1), 120);
    return () => clearTimeout(id);
  }, [result, visibleCount]);

  // No modo real, o envio precisa estar habilitado; no simulador, o botao sempre funciona.
  const envioBloqueado = !publishingSimulated && settings !== null && !settings.envioHabilitado;

  async function handleRun() {
    if (running) return; // trava contra clique duplo
    if (envioBloqueado) {
      toast(friendlyError(new Error("ENVIO_DESABILITADO")), "error");
      return;
    }
    const total = pendentes?.length ?? 0;
    const alvo = settings?.limitePorRodada && total > settings.limitePorRodada ? settings.limitePorRodada : total;
    if (total > 0 && !window.confirm(`Ligar o robo e processar ${alvo} boleto(s) pendente(s)?`)) {
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

  async function saveSettings(patch: Partial<Settings>, okMsg: string) {
    if (!settings) return;
    const anterior = settings;
    setSettingsState({ ...settings, ...patch });
    setSavingSettings(true);
    try {
      const s = await setSettings(patch);
      setSettingsState(s);
      toast(okMsg, "info");
    } catch (e) {
      setSettingsState(anterior);
      toast(friendlyError(e), "error");
    } finally {
      setSavingSettings(false);
    }
  }

  function toggleEnvio() {
    if (!settings) return;
    if (settings.envioHabilitado) {
      void saveSettings({ envioHabilitado: false, autoRun: false }, "Envio ao Zen desabilitado. Nada sera publicado.");
      return;
    }
    const corte = settings.dataCorte ?? hojeISO();
    const ok = window.confirm(
      `Habilitar o envio REAL de boletos ao Questor Zen?\n\n` +
        `So boletos emitidos a partir de ${dateOnly(corte)} entram, no maximo ${settings.limitePorRodada} por rodada. ` +
        `O modo automatico continua desligado ate voce liga-lo.`,
    );
    if (!ok) return;
    void saveSettings({ envioHabilitado: true, dataCorte: corte }, "Envio ao Zen habilitado.");
  }

  function toggleAuto() {
    if (!settings) return;
    const next = !settings.autoRun;
    void saveSettings({ autoRun: next }, next ? "Modo automatico ligado (7h as 19h)." : "Modo automatico desligado.");
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
      ["Venda", "Cliente", "CPF/CNPJ", "Valor", "Motivo"],
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
          {running
            ? "Processando…"
            : publishingSimulated
              ? "Simulador pronto"
              : envioBloqueado
                ? "Envio desabilitado"
                : "Robo pronto"}
        </div>
        <h1 className="font-display text-2xl font-semibold text-fg">
          {publishingSimulated ? "Simular publicacao de boletos" : "Publicar boletos no Questor Zen"}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          {running
            ? progress
              ? `${publishingSimulated ? "Simulando envio" : "Enviando ao e-Doc do Zen"}… (${progress.total} pendente(s))`
              : "Varrendo os boletos pendentes…"
            : pendingCount > 0
              ? `${pendingCount} boleto(s) pendente(s) para processar.`
              : "Nenhum boleto pendente no momento."}
        </p>

        <button
          onClick={handleRun}
          disabled={running || envioBloqueado}
          title={envioBloqueado ? "Ligue a chave geral do envio nos controles abaixo." : undefined}
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
        {envioBloqueado && (
          <p className="mt-3 text-xs text-warn">
            Nenhum boleto sera publicado enquanto a chave geral estiver desligada.
          </p>
        )}
      </section>

      {/* Controles do robo */}
      {settings && (
        <section className="hairline rounded-2xl bg-ink-800 p-5" aria-labelledby="controles-robo">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="controles-robo" className="font-display text-base font-semibold">
              Controles do robo
            </h2>
            <span className="text-xs text-fg-faint">{savingSettings ? "Salvando…" : "Salvo"}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input
                type="checkbox"
                checked={settings.envioHabilitado}
                onChange={toggleEnvio}
                disabled={savingSettings}
                className="mt-0.5 h-4 w-4 accent-flow"
              />
              <span className="text-sm">
                <span className="block font-medium text-fg">Envio ao Zen (chave geral)</span>
                <span className="block text-xs text-fg-muted">
                  {settings.envioHabilitado
                    ? "Ligado: o botao Ativar e o modo automatico podem publicar."
                    : "Desligado: nada e publicado, nem pelo botao Ativar."}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input
                type="checkbox"
                checked={settings.autoRun}
                onChange={toggleAuto}
                disabled={savingSettings || !settings.envioHabilitado}
                className="mt-0.5 h-4 w-4 accent-flow"
              />
              <span className="text-sm">
                <span className="block font-medium text-fg">Modo automatico</span>
                <span className="block text-xs text-fg-muted">
                  {settings.envioHabilitado
                    ? "Publica sozinho a cada janela do agendador, das 7h as 19h."
                    : "Disponivel depois de ligar a chave geral."}
                </span>
              </span>
            </label>

            <label className="block rounded-xl border border-line p-3 text-sm">
              <span className="block font-medium text-fg">Data de corte</span>
              <span className="mb-2 block text-xs text-fg-muted">
                So boletos emitidos a partir desta data entram.
              </span>
              <input
                type="date"
                value={settings.dataCorte ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) void saveSettings({ dataCorte: v }, `Data de corte: ${dateOnly(v)}.`);
                }}
                disabled={savingSettings}
                className="w-full rounded-md border border-line bg-ink-900 px-2 py-1.5 text-fg"
              />
            </label>

            <label className="block rounded-xl border border-line p-3 text-sm">
              <span className="block font-medium text-fg">Limite por rodada</span>
              <span className="mb-2 block text-xs text-fg-muted">Maximo de boletos publicados por execucao.</span>
              <input
                type="number"
                min={1}
                max={500}
                defaultValue={settings.limitePorRodada}
                key={settings.limitePorRodada}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 500 && n !== settings.limitePorRodada) {
                    void saveSettings({ limitePorRodada: n }, `Limite por rodada: ${n}.`);
                  }
                }}
                disabled={savingSettings}
                className="w-full rounded-md border border-line bg-ink-900 px-2 py-1.5 font-mono text-fg"
              />
            </label>
          </div>
        </section>
      )}

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
                  disabled={running || envioBloqueado}
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
