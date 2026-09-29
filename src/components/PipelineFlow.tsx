import type { SystemHealth } from "../types/api";
import { timeOnly } from "../lib/format";

// SIGNATURE do painel: o fluxo do boleto Conta Azul -> Integrador -> Zen.
// Pulsos representam boletos em transito; respeita prefers-reduced-motion
// (as animacoes sao neutralizadas pelo CSS global).

interface NodeProps {
  title: string;
  subtitle: string;
  tone: "ca" | "hub" | "zen";
}

function Node({ title, subtitle, tone }: NodeProps) {
  const ring =
    tone === "zen"
      ? "border-flow/50 shadow-[0_0_28px_-8px_rgba(63,214,140,0.5)]"
      : tone === "hub"
        ? "border-line"
        : "border-fg-muted/40";
  return (
    <div className={`relative z-10 w-40 rounded-xl border bg-ink-900 px-4 py-3 ${ring}`}>
      <div className="font-display text-sm font-semibold text-fg">{title}</div>
      <div className="mt-0.5 text-xs text-fg-muted">{subtitle}</div>
    </div>
  );
}

function Wire() {
  return (
    <div className="relative mx-1 h-px flex-1 self-center">
      <div className="absolute inset-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-fg-faint/30 via-line to-flow/60" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-flow shadow-[0_0_8px_2px_rgba(63,214,140,0.6)]"
          style={{
            left: 0,
            animation: "pulseFlow 2.8s linear infinite",
            animationDelay: `${i * 0.9}s`,
            // distancia percorrida definida em runtime pelo container flex
            ["--flow-distance" as string]: "100%",
          }}
        />
      ))}
    </div>
  );
}

export function PipelineFlow({ health }: { health: SystemHealth }) {
  return (
    <section className="hairline rounded-2xl bg-ink-800 p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">Fluxo de sincronizacao</h2>
          <p className="text-sm text-fg-muted">
            Boletos emitidos na Conta Azul chegam automaticamente ao e-Doc do Zen.
          </p>
        </div>
        <div className="text-right text-xs text-fg-faint">
          <div>
            Ultima sync <span className="font-mono text-fg-muted">{timeOnly(health.ultimaSync)}</span>
          </div>
          <div>
            Proxima <span className="font-mono text-fg-muted">{timeOnly(health.proximaSync)}</span> ·
            a cada {health.intervaloMin} min
          </div>
        </div>
      </div>

      <div className="flex items-stretch gap-1 overflow-hidden">
        <Node title="Conta Azul" subtitle="OAuth2 · vendas & PDF" tone="ca" />
        <Wire />
        <Node title="Integrador" subtitle="dedup · quarentena" tone="hub" />
        <Wire />
        <Node title="Questor Zen" subtitle="e-Doc · upload" tone="zen" />
      </div>
    </section>
  );
}
