import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * The dashboard shell, shared by every operational area.
 *
 * Admin, Employee and Pandit are three navigations over one implementation, not
 * three implementations. What differs between them is the list of destinations
 * and the label above it, and both are parameters; everything else - the rail,
 * the mobile behaviour, the table that falls back to cards, the pagination -
 * would otherwise be three copies drifting apart at three different speeds.
 *
 * Navigation here controls only what someone *sees*. Every route and every
 * Server Action authorizes independently on the server: a link that is hidden
 * is a link that would have been refused anyway, and a link that is shown is
 * still checked.
 */
export type DashboardNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Rendered as a disabled affordance rather than a dead link. */
  status?: "available" | "planned";
  /** A count shown beside the label, e.g. an open queue. */
  badge?: number;
};

export type DashboardNavGroup = {
  heading?: string;
  items: readonly DashboardNavItem[];
};

export function DashboardShell({
  groups,
  currentPath,
  railLabel,
  identityLabel,
  title,
  description,
  eyebrow,
  actions,
  contentMode = "standard",
  children,
}: {
  groups: readonly DashboardNavGroup[];
  currentPath: string;
  railLabel: string;
  identityLabel: string;
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  contentMode?: "standard" | "workspace";
  children: React.ReactNode;
}) {
  const flatItems = groups.flatMap((group) => group.items);

  return (
    <section className="min-h-[calc(100vh-var(--header-height))] bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* A rail rather than a floating card: it runs from under the site header
          to the bottom of the viewport and stays there while a long table
          scrolls past it. */}
      <aside className="hidden border-r border-slate-200 bg-slate-50 lg:block">
        <div className="sticky top-[var(--header-height)] flex h-[calc(100dvh-var(--header-height))] flex-col gap-4 overflow-y-auto px-3 py-5">
          <p className="px-3 caption font-semibold uppercase tracking-[0.2em] text-slate-400">{railLabel}</p>
          <DashboardSidebar currentPath={currentPath} groups={groups} />
        </div>
      </aside>

      <div
        className={cn(
          "admin-main min-w-0 text-slate-900",
          contentMode === "workspace" ? "bg-slate-100" : "bg-white px-4 py-8 sm:px-6 lg:px-10",
        )}
      >
        {contentMode === "workspace" ? (
          <>
            <div className="px-4 pt-4 lg:hidden">
              <DashboardMobileNav currentPath={currentPath} items={flatItems} />
            </div>
            {children}
          </>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <p className="caption font-semibold uppercase tracking-[0.2em] text-slate-400 lg:hidden">{railLabel}</p>
              <p className="caption text-slate-500 lg:ml-auto">Signed in as {identityLabel}</p>
            </div>

            <DashboardMobileNav currentPath={currentPath} items={flatItems} />

            <div className="mt-4 lg:mt-0">
              <DashboardHeader actions={actions} description={description} eyebrow={eyebrow} title={title} />
              <div className="grid gap-8">{children}</div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function DashboardSidebar({
  groups,
  currentPath,
}: {
  groups: readonly DashboardNavGroup[];
  currentPath: string;
}) {
  return (
    <nav aria-label="Dashboard navigation" className="hidden lg:grid lg:gap-4">
      {groups.map((group, index) => (
        <div className="grid gap-0.5" key={group.heading ?? `group-${index}`}>
          {group.heading ? (
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {group.heading}
            </p>
          ) : null}
          <ul className="grid gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <DashboardNavLink currentPath={currentPath} item={item} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function DashboardNavLink({ item, currentPath }: { item: DashboardNavItem; currentPath: string }) {
  const active = currentPath === item.href;
  const Icon = item.icon;

  if (item.status === "planned") {
    return (
      <span
        aria-disabled="true"
        className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-slate-400"
        title="Coming in a later release"
      >
        <Icon aria-hidden="true" className="shrink-0 text-slate-300" size={16} />
        <span className="truncate">{item.label}</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-slate-300">Soon</span>
      </span>
    );
  }

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
        active
          ? "bg-blue-50 font-semibold text-blue-700 shadow-xs"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
      href={item.href}
      prefetch={false}
    >
      <Icon aria-hidden="true" className={cn("shrink-0", active ? "text-blue-600" : "text-slate-400")} size={16} />
      <span className="truncate">{item.label}</span>
      {item.badge && item.badge > 0 ? (
        <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </Link>
  );
}

export function DashboardMobileNav({
  items,
  currentPath,
}: {
  items: readonly DashboardNavItem[];
  currentPath: string;
}) {
  const reachable = items.filter((item) => item.status !== "planned");

  return (
    <nav aria-label="Dashboard navigation" className="overflow-hidden lg:hidden">
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {reachable.map((item) => {
          const active = currentPath === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                  active
                    ? "border-blue-600 bg-blue-50 font-semibold text-blue-700 shadow-xs"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
                href={item.href}
                prefetch={false}
              >
                <Icon aria-hidden="true" size={15} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function DashboardHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 caption font-semibold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
        ) : null}
        <h1 className="heading-lg text-slate-900">{title}</h1>
        {description ? <p className="mt-2 body-sm text-slate-600">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function DashboardSection({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-3">
      {title ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="heading-sm text-slate-900">{title}</h2>
            {description ? <p className="mt-1 caption text-slate-500">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type StatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<StatusTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        TONE_CLASS[tone],
      )}
    >
      {label}
    </span>
  );
}

/** A headline figure. `hint` carries the qualification, never a fabricated trend. */
export function MetricCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: StatusTone;
}) {
  const body = (
    <>
      <p className="caption uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-semibold tabular-nums",
          tone === "danger" ? "text-rose-600" : tone === "warning" ? "text-amber-600" : "text-slate-900",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 caption text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link
        className="block rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        href={href}
        prefetch={false}
      >
        {body}
      </Link>
    );
  }

  return <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">{body}</div>;
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xs">
      <p className="body-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 caption text-slate-500">{description}</p> : null}
    </div>
  );
}

/**
 * Responsive table.
 *
 * A real `<table>` from `md` up for scanning density, and the same rows as
 * stacked cards below it, because a nine-column table is unusable at 375px.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  getKey,
  renderCell,
  renderCard,
  emptyMessage = "Nothing to show yet.",
}: {
  caption: string;
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Row[];
  getKey: (row: Row) => string;
  renderCell: (row: Row, columnKey: string) => React.ReactNode;
  renderCard: (row: Row) => React.ReactNode;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-xs">
        <p className="body-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              {columns.map((column) => (
                <th
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500",
                    column.align === "right" && "text-right",
                  )}
                  key={column.key}
                  scope="col"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr className="transition hover:bg-slate-50/70" key={getKey(row)}>
                {columns.map((column) => (
                  <td
                    className={cn("px-4 py-3.5 body-sm text-slate-700", column.align === "right" && "text-right")}
                    key={column.key}
                  >
                    {renderCell(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getKey(row)}>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">{renderCard(row)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Server-rendered pagination; state lives in the URL, not in client memory. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }
    params.set("page", String(target));
    return `${basePath}?${params.toString()}`;
  };

  const linkClass =
    "min-h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="caption text-slate-500">
        Page {page} of {pageCount} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className={linkClass} href={href(page - 1)} prefetch={false} rel="prev">
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link className={linkClass} href={href(page + 1)} prefetch={false} rel="next">
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Server-rendered search box. Submits as a GET so results are linkable. */
export function SearchBar({
  action,
  defaultValue,
  placeholder,
  extra = {},
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  extra?: Record<string, string | undefined>;
}) {
  const inputId = `search-${action.replace(/[^a-z0-9]+/gi, "-")}`;

  return (
    <form action={action} className="flex flex-wrap gap-2" method="get">
      {Object.entries(extra).map(([key, value]) =>
        value ? <input key={key} name={key} type="hidden" value={value} /> : null,
      )}
      <label className="sr-only" htmlFor={inputId}>
        {placeholder}
      </label>
      <SmoothInput
        className="form-control flex-1"
        defaultValue={defaultValue}
        id={inputId}
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}

/** A row of status filters that reads and writes the URL. */
export function FilterBar({
  basePath,
  current,
  options,
  paramName = "status",
}: {
  basePath: string;
  current?: string;
  options: ReadonlyArray<{ label: string; value: string | undefined }>;
  paramName?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = current === option.value || (!current && !option.value);
        const href = option.value ? `${basePath}?${paramName}=${encodeURIComponent(option.value)}` : basePath;

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
              active
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
            href={href}
            key={option.value ?? "all"}
            prefetch={false}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

/** A chronological list of decisions, newest first. */
export function AuditTimeline({
  entries,
}: {
  entries: ReadonlyArray<{
    id: string;
    title: string;
    detail?: string | null;
    actor?: string | null;
    at: Date;
    tone?: StatusTone;
  }>;
}) {
  if (entries.length === 0) {
    return <EmptyState description="Decisions will appear here as they are made." title="No history yet" />;
  }

  return (
    <ol className="grid gap-3">
      {entries.map((entry) => (
        <li className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs" key={entry.id}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={entry.title} tone={entry.tone ?? "neutral"} />
            <span className="caption text-slate-500">
              {entry.at.toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {entry.actor ? <span className="caption text-slate-500">· {entry.actor}</span> : null}
          </div>
          {entry.detail ? <p className="mt-2 body-sm text-slate-700">{entry.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
