// Placeholders de carregamento (shimmer) enquanto os dados chegam.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ink-700 ${className}`} />;
}

/** Skeleton no formato de uma tabela/lista com N linhas. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="hairline space-y-3 rounded-xl bg-ink-800 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Bar className="h-4 w-1/4" />
          <Bar className="h-4 w-1/3" />
          <Bar className="ml-auto h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
