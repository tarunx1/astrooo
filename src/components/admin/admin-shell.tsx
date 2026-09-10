import Link from "next/link";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ADMIN_NAVIGATION, type AdminNavItem } from "@/config/admin-navigation";
import { getAdminIdentity } from "@/lib/auth/admin";
import { SmoothInput } from "@/components/ui/smooth-input";

/**
 * Admin shell.
 *
 * Denser than the public pages but built from the same tokens and primitives, so
 * it reads as the same product rather than a bolted-on dashboard. Desktop gets a
 * sidebar; mobile gets a scrollable rail, and every table falls back to cards.
 */
export async function AdminLayout({
  currentPath,
  title,
  description,
  actions,
  children,
  adminName,
}: {
  currentPath: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  adminName: string;
}) {
  // Settings links are shown only to a super admin. This is presentation: every
  // settings route and action authorizes server-side, so hiding a link changes
  // what an operator sees and nothing about what they may reach.
  const identity = await getAdminIdentity();
  const navigation = ADMIN_NAVIGATION.filter((item) => !item.superAdminOnly || identity?.isSuperAdmin);

  return (
    <section className="star-field min-h-[calc(100vh-var(--header-height))] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* A rail rather than a floating card, matching the account dashboard:
          it runs from under the site header to the bottom of the viewport and
          stays there while a long table scrolls past it. */}
      <aside className="hidden border-r border-white/10 bg-surface/70 backdrop-blur-xl lg:block">
        <div className="sticky top-[var(--header-height)] flex h-[calc(100dvh-var(--header-height))] flex-col gap-3 overflow-y-auto px-3 py-5">
          <p className="px-3 caption uppercase tracking-[0.2em] text-premium">Operations</p>
          <AdminSidebar currentPath={currentPath} items={navigation} />
        </div>
      </aside>

      <div className="min-w-0 px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="caption uppercase tracking-[0.2em] text-premium lg:hidden">Tarun Astro Operations</p>
          <p className="caption text-foreground-muted lg:ml-auto">Signed in as {adminName}</p>
        </div>

        <AdminMobileNav currentPath={currentPath} items={navigation} />

        <div className="mt-4 lg:mt-0">
          <AdminHeader actions={actions} description={description} title={title} />
          <div className="grid gap-8">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function AdminSidebar({
  currentPath,
  items = ADMIN_NAVIGATION,
}: {
  currentPath: string;
  items?: readonly AdminNavItem[];
}) {
  return (
    <nav aria-label="Admin navigation" className="hidden lg:block">
      <ul className="grid gap-0.5">
          {items.map((item) => {
            const active = currentPath === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                    active
                      ? "bg-surface-raised text-foreground"
                      : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                  href={item.href}
                  prefetch={false}
                >
                  <Icon aria-hidden="true" className={cn("shrink-0", active && "text-primary")} size={16} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AdminMobileNav({
  currentPath,
  items = ADMIN_NAVIGATION,
}: {
  currentPath: string;
  items?: readonly AdminNavItem[];
}) {
  return (
    <nav aria-label="Admin navigation" className="overflow-hidden lg:hidden">
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = currentPath === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                  active
                    ? "border-primary bg-surface-raised text-foreground"
                    : "border-border bg-surface text-foreground-muted",
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

export function AdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="heading-lg">{title}</h1>
        {description ? <p className="mt-2 body-sm text-foreground-secondary">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function AdminSection({
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
            <h2 className="heading-sm">{title}</h2>
            {description ? <p className="mt-1 caption text-foreground-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export type AdminStatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<AdminStatusTone, string> = {
  positive: "border-success/50 text-success",
  warning: "border-warning/60 text-warning",
  danger: "border-danger/50 text-danger",
  info: "border-primary/60 text-primary",
  neutral: "border-border text-foreground-muted",
};

export function AdminStatusBadge({ label, tone = "neutral" }: { label: string; tone?: AdminStatusTone }) {
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

/**
 * Responsive table.
 *
 * A real `<table>` from `md` up for scanning density, and the same rows as
 * stacked cards below it, because a nine-column table is unusable at 375px.
 */
export function AdminTable<Row>({
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
      <Card className="p-6 text-center" variant="glass">
        <p className="body-sm text-foreground-muted">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <>
      <Card className="hidden overflow-x-auto md:block" variant="glass">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-border">
              {columns.map((column) => (
                <th
                  className={cn(
                    "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-foreground-muted",
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
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-border last:border-b-0 hover:bg-surface-hover" key={getKey(row)}>
                {columns.map((column) => (
                  <td
                    className={cn("px-4 py-3 body-sm text-foreground-secondary", column.align === "right" && "text-right")}
                    key={column.key}
                  >
                    {renderCell(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={getKey(row)}>
            <Card className="p-4" variant="glass">{renderCard(row)}</Card>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Server-rendered pagination; state lives in the URL, not in client memory. */
export function AdminPagination({
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

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      <p className="caption text-foreground-muted">
        Page {page} of {pageCount} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className="min-h-9 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            href={href(page - 1)}
            prefetch={false}
            rel="prev"
          >
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            className="min-h-9 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            href={href(page + 1)}
            prefetch={false}
            rel="next"
          >
            Next
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Server-rendered search box. Submits as a GET so results are linkable. */
export function AdminSearch({
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
  return (
    <form action={action} className="flex flex-wrap gap-2" method="get">
      {Object.entries(extra).map(([key, value]) =>
        value ? <input key={key} name={key} type="hidden" value={value} /> : null,
      )}
      <label className="sr-only" htmlFor="admin-search">
        {placeholder}
      </label>
      <SmoothInput
        className="form-control flex-1"
        defaultValue={defaultValue}
        id="admin-search"
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button
        className="min-h-10 rounded-md border border-border-strong bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
