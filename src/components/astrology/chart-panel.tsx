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
export type ChartTab = {
  id: string;
  label: string;
  content: ReactNode;
  /**
   * Which band of the workspace this belongs to. Tabs without one sit in the
   * first band, so an ungrouped caller keeps working unchanged.
   */
  group?: string;
};

export function ChartPanel({ tabs, className }: { tabs: ChartTab[]; className?: string }) {
  const groupId = useId();
  const [active, setActive] = useState(tabs[0]?.id);

  if (tabs.length === 0) return null;

  /**
   * Tabs in their declared order, banded by group.
   *
   * The workspace grew from four tabs to ten, and a single unbroken row of ten
   * gives a reader no way to tell that Ashtakavarga and Jaimini are different
   * kinds of thing. Grouping is presentation only - the tab list, the ids and
   * the panels are untouched - so nothing about selection or accessibility
   * changes with it.
   */
  const bands: Array<{ name: string | null; tabs: ChartTab[] }> = [];
  for (const tab of tabs) {
    const name = tab.group ?? null;
    const last = bands.at(-1);
    if (last && last.name === name) last.tabs.push(tab);
    else bands.push({ name, tabs: [tab] });
  }

  const renderTab = (tab: ChartTab) => {
    const selected = tab.id === active;
    return (
            <button
              aria-controls={`${groupId}-${tab.id}`}
              aria-selected={selected}
              className={cn(
                "min-h-10 shrink-0 rounded-md border px-3.5 py-2 text-xs font-semibold transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                selected
                  ? "border-premium/80 bg-premium/10 text-foreground shadow-[var(--shadow-sm)]"
                  : "border-border bg-background/50 text-foreground-muted hover:border-border-strong hover:text-foreground",
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
  };

  return (
    <div className={cn("grid gap-5", className)}>
      <div className="-mx-1 grid max-w-full gap-2 px-1 pb-1">
        {bands.map((band) => (
          <div className="flex items-center gap-2 overflow-x-auto" key={band.name ?? "ungrouped"}>
            {band.name ? (
              <span className="shrink-0 caption uppercase tracking-[0.14em] text-foreground-muted">
                {band.name}
              </span>
            ) : null}
            <div className="flex gap-2" role="tablist">
              {band.tabs.map(renderTab)}
            </div>
          </div>
        ))}
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
