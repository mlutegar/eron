export function Loading({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-10 text-sm text-fg-muted">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-flow" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="hairline rounded-xl border-danger/30 bg-danger/5 px-5 py-4 text-sm text-danger">
      {message}
    </div>
  );
}
