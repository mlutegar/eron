import type { HealthState, SyncStatus } from "../types/api";

const syncStyles: Record<SyncStatus, string> = {
  SINCRONIZADO: "bg-flow/10 text-flow border-flow/30",
  REGISTRADO: "bg-fg-muted/10 text-fg-muted border-fg-muted/30",
  QUARENTENA: "bg-warn/10 text-warn border-warn/30",
  ERRO: "bg-danger/10 text-danger border-danger/30",
};

const syncLabel: Record<SyncStatus, string> = {
  SINCRONIZADO: "Sincronizado",
  REGISTRADO: "Aguardando",
  QUARENTENA: "Quarentena",
  ERRO: "Erro",
};

export function StatusBadge({ status }: { status: SyncStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${syncStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {syncLabel[status]}
    </span>
  );
}

const healthDot: Record<HealthState, string> = {
  OK: "bg-flow",
  ATENCAO: "bg-warn",
  FALHA: "bg-danger",
};

export function HealthDot({ state }: { state: HealthState }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${healthDot[state]}`} aria-hidden />;
}
