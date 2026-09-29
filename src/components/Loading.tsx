export function Loading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-10 text-sm text-fg-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-flow" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="hairline flex flex-wrap items-center justify-between gap-3 rounded-xl border-danger/30 bg-danger/5 px-5 py-4 text-sm text-danger">
      <span>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-lg border border-danger/40 px-3 py-1 text-xs font-medium hover:bg-danger/10"
        >
          Tentar de novo
        </button>
      )}
    </div>
  );
}
