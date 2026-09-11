import Link from "next/link";
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
    <section className="min-h-[calc(100vh-var(--header-height))] bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      {/* A rail rather than a floating card, matching the account dashboard:
          it runs from under the site header to the bottom of the viewport and
          stays there while a long table scrolls past it. */}
      <aside className="hidden border-r border-slate-200 bg-slate-50 lg:block">
        <div className="sticky top-[var(--header-height)] flex h-[calc(100dvh-var(--header-height))] flex-col gap-3 overflow-y-auto px-3 py-5">
          <p className="px-3 caption uppercase tracking-[0.2em] text-slate-400 font-semibold">Operations</p>
          <AdminSidebar currentPath={currentPath} items={navigation} />
        </div>
      </aside>

      <div className="admin-main min-w-0 bg-white px-4 py-8 text-slate-900 sm:px-6 lg:px-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <p className="caption uppercase tracking-[0.2em] text-slate-400 font-semibold lg:hidden">Tarun Astro Operations</p>
          <p className="caption text-slate-500 lg:ml-auto">Signed in as {adminName}</p>
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
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                    active
                      ? "bg-blue-50 text-blue-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                  )}
                  href={item.href}
                  prefetch={false}
                >
                  <Icon aria-hidden="true" className={cn("shrink-0", active ? "text-blue-600" : "text-slate-400")} size={16} />
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
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
                  active
                    ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold shadow-xs"
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
        <h1 className="heading-lg text-slate-900">{title}</h1>
        {description ? <p className="mt-2 body-sm text-slate-600">{description}</p> : null}
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

export type AdminStatusTone = "positive" | "warning" | "danger" | "neutral" | "info";

const TONE_CLASS: Record<AdminStatusTone, string> = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
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
      <p className="caption text-slate-500">
        Page {page} of {pageCount} · {total} total
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            className="min-h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            href={href(page - 1)}
            prefetch={false}
            rel="prev"
          >
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            className="min-h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
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
        className="min-h-10 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        type="submit"
      >
        Search
      </button>
    </form>
  );
}
