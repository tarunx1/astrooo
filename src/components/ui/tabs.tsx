import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  active?: boolean;
};

export function Tabs({ tabs, className }: { tabs: Tab[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="tablist">
      {tabs.map((tab) => (
        <button
          aria-selected={Boolean(tab.active)}
          className={cn(
            "rounded-md border px-4 py-2 body-sm font-semibold transition",
            tab.active
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-foreground-secondary hover:bg-surface-hover",
          )}
          key={tab.label}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
