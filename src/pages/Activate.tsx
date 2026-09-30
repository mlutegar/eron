import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      {ok ? "Enviado" : "Nao enviado"}
    </span>
  );
}

/** Traduz os codigos do backend em orientacao para o operador. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/ENVIO_DESABILITADO/.test(msg)) {
    return "O envio esta desligado. Ligue \"Enviar boletos ao Zen\" para enviar.";
  }
  if (/SEM_DATA_CORTE/.test(msg)) {
    return "Defina a data de inicio antes de enviar.";
  }
  if (/ZEN_NAO_CONFIGURADO/.test(msg)) {
    return "O Questor Zen ainda nao esta configurado neste servidor. Nenhum documento foi publicado.";
  }
  if (/DATA_CORTE_INVALIDA/.test(msg)) {
    return /recuar/.test(msg) ? "Para voltar a data de inicio, desligue antes \"Enviar boletos ao Zen\"." : "Data de inicio invalida.";
  }
  if (/FORA_DO_HORARIO/.test(msg)) {
    return "Fora do horario de envio (7h as 19h).";
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
    if (total > 0 && !window.confirm(`Enviar agora ${alvo} boleto(s) ao Questor Zen?`)) {
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
      void saveSettings({ envioHabilitado: false, autoRun: false }, "Envio desligado. Nenhum boleto sera enviado ao Zen.");
      return;
    }
    const corte = settings.dataCorte ?? hojeISO();
    const ok = window.confirm(
      `Ligar o envio de boletos ao Questor Zen?\n\n` +
        `Serao enviados os boletos em aberto emitidos a partir de ${dateOnly(corte)}. ` +
        `O cliente recebe o aviso do Zen por e-mail.`,
    );
    if (!ok) return;
    void saveSettings({ envioHabilitado: true, dataCorte: corte }, "Envio ligado.");
  }

  function toggleAuto() {
    if (!settings) return;
    const next = !settings.autoRun;
    void saveSettings({ autoRun: next }, next ? "Envio automatico ligado (a cada 10 min, das 7h as 19h)." : "Envio automatico desligado.");
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
      {/* Estado do envio */}
      <section className="hairline rounded-2xl bg-ink-800 px-6 py-8 text-center">
        {publishingSimulated ? (
          <StatusLine tone="warn" titulo="Simulador" texto="Dados ficticios. O botao abaixo so simula o envio." />
        ) : !settings ? null : !settings.envioHabilitado ? (
          <StatusLine tone="warn" titulo="Envio desligado" texto="Nenhum boleto esta sendo enviado ao Questor Zen." />
        ) : settings.autoRun ? (
          <StatusLine
            tone="ok"
            titulo="Envio ligado"
            texto={`Boletos emitidos a partir de ${dateOnly(settings.dataCorte ?? hojeISO())} sao enviados automaticamente, a cada 10 minutos, das 7h as 19h.`}
          />
        ) : (
          <StatusLine
            tone="warn"
            titulo="Envio ligado, automatico desligado"
            texto={`Boletos emitidos a partir de ${dateOnly(settings.dataCorte ?? hojeISO())} so sao enviados quando voce clicar em Enviar agora.`}
          />
        )}

        <p className="mx-auto mt-5 max-w-md text-sm text-fg-muted">
          {running
            ? `${publishingSimulated ? "Simulando envio" : "Enviando ao Questor Zen"}… (${progress?.total ?? 0} boleto(s))`
            : pendingCount > 0
              ? `${pendingCount} boleto(s) aguardando envio.`
              : "Nenhum boleto aguardando envio."}
        </p>

        <button
          onClick={handleRun}
          disabled={running || envioBloqueado}
          title={envioBloqueado ? "Ligue \"Enviar boletos ao Zen\" abaixo para poder enviar." : undefined}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-flow/40 bg-flow/15 px-8 py-3 font-display text-base font-semibold text-flow transition-transform hover:bg-flow/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? (
            <>
              <Spinner /> Enviando…
            </>
          ) : (
            <>
              <PlayIcon /> Enviar agora
            </>
          )}
        </button>
        <p className="mx-auto mt-3 max-w-md text-xs text-fg-faint">
          {envioBloqueado
            ? "Disponivel depois de ligar \"Enviar boletos ao Zen\"."
            : "Envia na hora os boletos que estao aguardando, sem esperar os 10 minutos."}
        </p>
      </section>

      {/* Configuracao do envio: 3 passos */}
      {settings && (
        <section className="hairline rounded-2xl bg-ink-800 p-5" aria-labelledby="config-envio">
          <div className="mb-1 flex items-center justify-between">
            <h2 id="config-envio" className="font-display text-base font-semibold">
              Configuracao do envio
            </h2>
            <span className="text-xs text-fg-faint">{savingSettings ? "Salvando…" : "Salvo"}</span>
          </div>
          <p className="mb-4 text-xs text-fg-muted">Faca uma vez, nesta ordem. Depois o envio funciona sozinho.</p>

          <ol className="space-y-3">
            <Passo n={1} titulo="Data de inicio" texto="So os boletos emitidos a partir desta data serao enviados. Os anteriores ficam de fora.">
              <input
                type="date"
                aria-label="Data de inicio"
                defaultValue={settings.dataCorte ?? ""}
                key={settings.dataCorte ?? "sem-data"}
                onBlur={(e) => {
                  // Salva so ao sair do campo e com ano completo: evita gravar "0002-10-01" enquanto digita.
                  const v = e.target.value;
                  if (/^20\d{2}-\d{2}-\d{2}$/.test(v) && v !== settings.dataCorte) {
                    void saveSettings({ dataCorte: v }, `Data de inicio: ${dateOnly(v)}.`);
                  }
                }}
                disabled={savingSettings}
                className="mt-2 w-full max-w-xs rounded-md border border-line bg-ink-900 px-2 py-1.5 text-fg"
              />
            </Passo>

            <Passo
              n={2}
              titulo="Enviar boletos ao Zen"
              texto="Liga ou desliga todo o envio. Desligado, nenhum boleto e enviado, nem pelo botao Enviar agora."
              toggle={{
                checked: settings.envioHabilitado,
                onChange: toggleEnvio,
                disabled: savingSettings || (!settings.envioHabilitado && !settings.dataCorte),
                aviso: !settings.envioHabilitado && !settings.dataCorte ? "Defina a data de inicio primeiro." : undefined,
              }}
            />

            <Passo
              n={3}
              titulo="Envio automatico"
              texto="Envia sozinho a cada 10 minutos, das 7h as 19h. Desligado, so envia quando voce clicar em Enviar agora."
              toggle={{
                checked: settings.autoRun,
                onChange: toggleAuto,
                disabled: savingSettings || !settings.envioHabilitado,
                aviso: !settings.envioHabilitado ? "Disponivel depois de ligar o passo 2." : undefined,
              }}
            />
          </ol>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-xs text-fg-faint hover:text-fg-muted">Avancado</summary>
            <label className="mt-3 block max-w-xs">
              <span className="block font-medium text-fg">Limite por envio</span>
              <span className="mb-2 block text-xs text-fg-muted">Maximo de boletos enviados de uma vez. Padrao: 20.</span>
              <input
                type="number"
                min={1}
                max={500}
                defaultValue={settings.limitePorRodada}
                key={settings.limitePorRodada}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 500 && n !== settings.limitePorRodada) {
                    void saveSettings({ limitePorRodada: n }, `Limite por envio: ${n}.`);
                  }
                }}
                disabled={savingSettings}
                className="w-full rounded-md border border-line bg-ink-900 px-2 py-1.5 font-mono text-fg"
              />
            </label>
          </details>
        </section>
      )}

      {/* Resultado da execucao */}
      {result && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <h2 className="font-display text-lg font-semibold">Resultado</h2>
            <span className="text-sm text-flow">{result.subiram} enviado(s)</span>
            {result.naoSubiram > 0 && (
              <span className="text-sm text-danger">{result.naoSubiram} nao enviado(s)</span>
            )}
            <span className="text-sm text-fg-muted">{brl(result.valorPublicado)} no total</span>
            <span className="ml-auto text-xs text-fg-faint">
              Ultimo envio: {dateTime(result.executadoEm)}
            </span>
          </div>

          {/* Falhas agrupadas por motivo */}
          {gruposFalha.length > 0 && (
            <div className="hairline rounded-xl bg-ink-800 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-fg-faint">
                Motivos dos nao enviados
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
                  Tentar de novo os nao enviados
                </button>
                <button
                  onClick={exportFailuresCsv}
                  className="rounded-lg border border-line px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
                >
                  Baixar lista (CSV)
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
            empty="Nenhum boleto enviado nesta execucao."
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

function StatusLine({ tone, titulo, texto }: { tone: "ok" | "warn"; titulo: string; texto: string }) {
  const cor = tone === "ok" ? "text-flow" : "text-warn";
  const ponto = tone === "ok" ? "bg-flow animate-breathe" : "bg-warn";
  return (
    <div role="status">
      <div className={`inline-flex items-center gap-2 font-display text-lg font-semibold ${cor}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${ponto}`} aria-hidden />
        {titulo}
      </div>
      <p className="mx-auto mt-1 max-w-md text-sm text-fg-muted">{texto}</p>
    </div>
  );
}

function Passo({
  n,
  titulo,
  texto,
  toggle,
  children,
}: {
  n: number;
  titulo: string;
  texto: string;
  toggle?: { checked: boolean; onChange: () => void; disabled: boolean; aviso?: string };
  children?: ReactNode;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-line p-3">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-flow/15 font-mono text-xs text-flow">{n}</span>
      <div className="min-w-0 flex-1 text-sm">
        {toggle ? (
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block font-medium text-fg">{titulo}</span>
              <span className="block text-xs text-fg-muted">{texto}</span>
              {toggle.aviso && <span className="mt-1 block text-xs text-warn">{toggle.aviso}</span>}
            </span>
            <span className="flex items-center gap-2 pt-0.5">
              <span className={`text-xs ${toggle.checked ? "text-flow" : "text-fg-faint"}`}>{toggle.checked ? "Ligado" : "Desligado"}</span>
              <input
                type="checkbox"
                role="switch"
                aria-label={titulo}
                checked={toggle.checked}
                onChange={toggle.onChange}
                disabled={toggle.disabled}
                className="h-4 w-4 accent-flow"
              />
            </span>
          </label>
        ) : (
          <>
            <span className="block font-medium text-fg">{titulo}</span>
            <span className="block text-xs text-fg-muted">{texto}</span>
            {children}
          </>
        )}
      </div>
    </li>
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
