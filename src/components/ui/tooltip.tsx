import { cn } from "@/lib/utils";

export function Tooltip({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex", className)}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-sm border border-border bg-surface px-2 py-1 caption text-foreground-secondary shadow-[var(--shadow-sm)] group-hover:block">
        {label}
      </span>
    </span>
  );
}
