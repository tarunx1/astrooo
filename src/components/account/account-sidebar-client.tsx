"use client";

import Link from "next/link";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useState } from "react";
import { accountNavigation } from "@/config/account-navigation";
import { Card } from "@/components/ui/card";
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
      <Icon aria-hidden="true" className={cn("shrink-0", active ? "text-primary" : "text-foreground-muted")} size={20} />
      <span className={cn("truncate transition-opacity", collapsed ? "sr-only" : "opacity-100")}>{item.label}</span>
    </>
  );
}

export function AccountDesktopShell({
  currentPath,
  children,
}: {
  currentPath: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const toggleLabel = collapsed ? "Expand account sidebar" : "Minimize account sidebar";
  const ToggleIcon = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <div
      className={cn(
        "grid gap-4 lg:relative lg:left-1/2 lg:w-screen lg:-translate-x-1/2 lg:grid-cols-[var(--account-sidebar-width)_minmax(0,1fr)] lg:gap-0",
        collapsed
          ? "lg:[--account-sidebar-offset:88px] lg:[--account-sidebar-width:64px]"
          : "lg:[--account-sidebar-offset:288px] lg:[--account-sidebar-width:248px]",
      )}
    >
      <nav aria-label="Account navigation" className="overflow-hidden lg:hidden">
        <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {accountNavigation
            .filter((item) => item.status === "available")
            .map((item) => {
              const active = currentPath === item.href;

              return (
                <li key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded-md border px-3.5 py-2 text-sm font-medium transition",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                      active
                        ? "border-primary bg-surface-raised text-foreground"
                        : "border-border bg-surface text-foreground-muted",
                    )}
                    href={item.href}
                    prefetch={false}
                  >
                    <NavLabel active={active} collapsed={false} item={item} />
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>

      <nav
        aria-label="Account navigation"
        className="z-30 hidden w-[var(--account-sidebar-width)] transition-[width] duration-200 lg:sticky lg:top-[var(--header-height)] lg:-mt-[var(--section-space-md)] lg:block lg:self-start"
      >
        <Card
          // Glass by class rather than by variant. The variant routes through
          // GlassCard, which wraps its children in a `relative overflow-hidden`
          // client element - that clips a nav which needs to scroll, and adds
          // pointer tracking to a panel that is never hovered for effect.
          className="flex flex-col rounded-l-none rounded-tl-none border-l-0 border-t-0 border-white/15 bg-surface-raised/80 p-2 backdrop-blur-2xl"
        >
          <button
            aria-expanded={!collapsed}
            aria-label={toggleLabel}
            className={cn(
              "mb-2 flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-foreground-muted transition hover:bg-surface-hover hover:text-foreground",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
              collapsed ? "justify-center" : "justify-between",
            )}
            onClick={() => setCollapsed((value) => !value)}
            title={toggleLabel}
            type="button"
          >
            <span className={collapsed ? "sr-only" : "truncate"}>Account</span>
            <ToggleIcon aria-hidden="true" className="shrink-0" size={18} />
          </button>

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
                        "flex cursor-not-allowed items-center rounded-md py-2.5 text-sm font-medium text-foreground-muted/60",
                        collapsed ? "justify-center px-2" : "gap-3 px-3",
                      )}
                      title={collapsed ? `${item.label} - coming soon` : "Coming in a later release"}
                    >
                      <NavLabel active={false} collapsed={collapsed} item={item} />
                      {collapsed ? null : (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-foreground-muted/70">Soon</span>
                      )}
                    </span>
                  ) : (
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center rounded-md py-2.5 text-sm font-medium transition",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                        collapsed ? "justify-center px-2" : "gap-3 px-3",
                        active
                          ? "bg-surface-raised text-foreground"
                          : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                      )}
                      href={item.href}
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
        </Card>
      </nav>

      <div className="min-w-0 px-5 transition-[padding] duration-200 sm:px-8 lg:mx-auto lg:w-full lg:max-w-[calc(var(--container-xl)-var(--account-sidebar-offset))] lg:px-0 lg:pl-10">
        {children}
      </div>
    </div>
  );
}
