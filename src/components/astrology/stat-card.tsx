export function AstrologyStatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="astro-card min-w-0 p-5 sm:p-6">
      <p className="caption uppercase tracking-[0.08em] text-foreground-muted">{label}</p>
      <p className="mt-3 truncate heading-md leading-tight text-premium" title={typeof value === "string" ? value : undefined}>
        {value}
      </p>
    </article>
  );
}
