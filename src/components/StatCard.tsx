interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

export function StatCard({ label, value, hint, accent }: StatCardProps) {
  return (
    <div className="hairline rounded-xl bg-ink-800 p-4 md:p-5">
      <div className="text-xs uppercase tracking-wider text-fg-faint">{label}</div>
      <div
        className={`mt-2 font-display text-2xl font-semibold tnum md:text-3xl ${
          accent ? "text-flow" : "text-fg"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-sm text-fg-muted">{hint}</div>}
    </div>
  );
}
