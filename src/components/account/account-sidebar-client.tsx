"use client";

import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { accountNavigation } from "@/config/account-navigation";
import { cn } from "@/lib/utils";

function NavLabel({
  item,
  active,
  collapsed,
}: {
  item: (typeof accountNavigation)[number];
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <>
      <Icon aria-hidden="true" className={cn("shrink-0", active ? "text-blue-600" : "text-slate-400")} size={20} />
      <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
    </>
  );
}

function AccountNavItems({
  currentPath,
  collapsed,
  onNavigate,
}: {
  currentPath: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="grid gap-1">
      {accountNavigation.map((item) => {
        const active = currentPath === item.href;
        const planned = item.status === "planned";

        return (
          <li key={item.href}>
            {planned ? (
              <span
                aria-disabled="true"
                className={cn(
                  "flex min-h-11 cursor-not-allowed items-center rounded-md text-sm font-medium text-slate-400",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                )}
                title={collapsed ? `${item.label} - coming soon` : "Coming in a later release"}
              >
                <NavLabel active={false} collapsed={collapsed} item={item} />
                {collapsed ? null : (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-blue-300">Soon</span>
                )}
              </span>
            ) : (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-md text-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  active
                    ? "bg-white font-semibold text-blue-700 shadow-[inset_3px_0_0_#1e3a8a]"
                    : "text-blue-100 hover:bg-blue-600 hover:text-white",
                )}
                href={item.href}
                onClick={onNavigate}
                prefetch={false}
                title={collapsed ? item.label : undefined}
              >
                <NavLabel active={active} collapsed={collapsed} item={item} />
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function AccountDashboardShell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleLabel = collapsed ? "Expand account sidebar" : "Minimize account sidebar";
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  useEffect(() => {
    if (!mobileOpen) return;

    const originalOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  return (
    <div
      className={cn(
        "min-h-[calc(100vh-var(--header-height))] xl:grid xl:transition-[grid-template-columns] xl:duration-200",
        collapsed ? "xl:grid-cols-[76px_minmax(0,1fr)]" : "xl:grid-cols-[264px_minmax(0,1fr)]",
      )}
    >
      <aside className="hidden border-r border-blue-800 bg-blue-700 xl:block">
        <div className="sticky top-[var(--header-height)] flex h-[calc(100vh-var(--header-height))] flex-col overflow-y-auto px-4 py-5">
          <button
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            className={cn(
              "mb-5 flex min-h-10 items-center rounded-md text-sm font-semibold text-blue-100 transition hover:bg-blue-600 hover:text-white",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              collapsed ? "justify-center px-2" : "justify-between px-3",
            )}
            onClick={() => setCollapsed((value) => !value)}
            title={toggleLabel}
            type="button"
          >
            <span className={collapsed ? "sr-only" : "truncate"}>Account</span>
            <ToggleIcon aria-hidden="true" className="shrink-0" size={18} />
          </button>

          <nav aria-label="Account navigation">
            <AccountNavItems collapsed={collapsed} currentPath={currentPath} />
          </nav>
        </div>
      </aside>

      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 xl:hidden">
        <button
          aria-expanded={mobileOpen}
          aria-label="Open account navigation"
          className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu aria-hidden="true" size={18} />
          Account menu
        </button>
      </div>

      {mobileOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm xl:hidden"
          onClick={() => setMobileOpen(false)}
          role="presentation"
        >
          <aside
            aria-label="Account navigation"
            aria-modal="true"
            className="h-full w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-r border-border bg-surface px-4 py-5 shadow-[var(--shadow-lg)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="mb-5 flex min-h-10 items-center justify-between gap-3 px-3">
              <span className="text-sm font-semibold text-foreground-muted">Account</span>
              <button
                aria-label="Close account navigation"
                className="grid size-9 place-items-center rounded-md text-foreground-muted transition hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                onClick={() => setMobileOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <nav aria-label="Account navigation">
              <AccountNavItems collapsed={false} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-8 sm:px-6 md:px-8 xl:px-10 xl:py-10" data-surface="light">
        <div className="mx-auto w-full max-w-[var(--container-lg)]">{children}</div>
      </main>
    </div>
  );
}
