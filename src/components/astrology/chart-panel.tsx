"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Switches between charts.
 *
 * The charts themselves arrive already rendered from the server; this only
 * decides which is shown. Keeping the SVGs out of the client bundle means the
 * chart still appears with JavaScript disabled, in a PDF and in print, and the
 * only thing that needs the browser is the button.
 */
export type ChartTab = { id: string; label: string; content: ReactNode };

export function ChartPanel({ tabs, className }: { tabs: ChartTab[]; className?: string }) {
  const groupId = useId();
  const [active, setActive] = useState(tabs[0]?.id);

  if (tabs.length === 0) return null;

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <button
              aria-controls={`${groupId}-${tab.id}`}
              aria-selected={selected}
              className={cn(
                "min-h-9 rounded-md border px-3 py-1.5 text-xs font-semibold transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                selected
                  ? "border-premium bg-surface-raised text-foreground"
                  : "border-border-strong bg-surface text-foreground-muted hover:text-foreground",
              )}
              id={`${groupId}-tab-${tab.id}`}
              key={tab.id}
              onClick={() => setActive(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {tabs.map((tab) => (
        <div
          aria-labelledby={`${groupId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          id={`${groupId}-${tab.id}`}
          key={tab.id}
          role="tabpanel"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
