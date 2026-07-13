"use client";

export function ProgressBar({
  value,
  className,
}: {
  value?: number;
  className?: string;
}) {
  const pct = value !== undefined ? Math.min(100, Math.max(0, value)) : null;

  return (
    <div
      className={`h-2 w-full rounded-[6px] bg-[var(--light-cream)] overflow-hidden ${className ?? ""}`}
    >
      {pct === null ? (
        // Indeterminate
        <div className="h-full w-1/2 bg-[var(--charcoal)] animate-pulse rounded-[6px]" />
      ) : (
        // Determinate
        <div
          className="h-full bg-[var(--charcoal)] transition-all duration-300 rounded-[6px]"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
