"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileChartColumn,
  PackageCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import type { SuperAdminDashboardData, SuperDashboardMetric } from "@/lib/admin/super-dashboard";
import { UserGlobeCard } from "@/components/analytics/user-globe-card";

const PANEL = "rounded-[5px] border border-border bg-card shadow-[var(--shadow-sm)]";

function PanelTitle({ title, subtitle, live = false }: { title: string; subtitle?: string; live?: boolean }) {
  return (
    <div className="border-b border-border px-4 py-3.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
        {live ? <span aria-hidden="true" className="size-5 rounded-full bg-primary/12" /> : null}
        <h2>{title}</h2>
        <CircleHelp aria-label={`About ${title}`} className="text-muted-foreground" size={15} strokeWidth={2} />
      </div>
      {subtitle ? <p className="mt-1 text-[12px] text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

function MetricChange({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">New</span>;
  const positive = value >= 0;
  return (
    <span className={positive ? "text-success" : "text-danger"}>
      {positive ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}

function MetricSelector({
  metrics,
  selectedId,
  onSelect,
}: {
  metrics: SuperDashboardMetric[];
  selectedId: SuperDashboardMetric["id"];
  onSelect: (id: SuperDashboardMetric["id"]) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
      {metrics.map((metric) => {
        const selected = selectedId === metric.id;
        return (
          <button
            aria-selected={selected}
            className={`min-w-[132px] rounded-[8px] border px-3.5 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              selected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-border-strong"
            }`}
            key={metric.id}
            onClick={() => onSelect(metric.id)}
            role="tab"
            type="button"
          >
            <span className={`block text-[12px] font-medium ${selected ? "text-primary" : "text-foreground-secondary"}`}>
              {metric.label}
            </span>
            <span className="mt-1 flex items-baseline gap-1.5">
              <span className="text-[22px] leading-none text-foreground tabular-nums">{metric.value}</span>
              <span className="text-[10px] font-semibold"><MetricChange value={metric.changePercent} /></span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EngagementChart({ metric }: { metric: SuperDashboardMetric }) {
  const width = 760;
  const height = 236;
  const left = 44;
  const right = 18;
  const top = 22;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maxValue = Math.max(3, ...metric.points.map((point) => point.value));
  const yMax = Math.ceil(maxValue / 3) * 3;
  const positions = metric.points.map((point, index) => ({
    x: left + (index / Math.max(metric.points.length - 1, 1)) * plotWidth,
    y: top + plotHeight - (point.value / yMax) * plotHeight,
  }));
  const solid = positions.slice(0, -1).map((point) => `${point.x},${point.y}`).join(" ");
  const projected = positions.slice(-2).map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="relative mt-4 min-h-[236px] w-full">
      <svg aria-label={`${metric.label} for the last eight days`} className="h-auto w-full" role="img" viewBox={`0 0 ${width} ${height}`}>
        {Array.from({ length: 4 }, (_, index) => {
          const y = top + (index / 3) * plotHeight;
          const value = Math.round(yMax - (index / 3) * yMax);
          return (
            <g key={value}>
              <line stroke="var(--chart-grid)" strokeDasharray="2 2" x1={left} x2={width - right} y1={y} y2={y} />
              <text fill="var(--chart-label)" fontSize="10" textAnchor="end" x={left - 14} y={y + 4}>{value}</text>
            </g>
          );
        })}
        <polyline fill="none" points={solid} stroke="var(--primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
        <polyline fill="none" points={projected} stroke="var(--primary)" strokeDasharray="2 6" strokeLinecap="round" strokeWidth="2.2" />
        {metric.points.map((point, index) => (
          <text fill="var(--chart-label)" fontSize="10" key={point.date} textAnchor="middle" x={positions[index].x} y={height - 10}>
            {point.label}
          </text>
        ))}
        <text fill="var(--chart-label)" fontSize="10" textAnchor="middle" transform={`rotate(-90 12 ${top + plotHeight / 2})`} x="12" y={top + plotHeight / 2}>
          Records
        </text>
      </svg>
      <Link
        aria-label="Open detailed analytics"
        className="absolute right-0 top-0 grid size-7 place-items-center rounded border border-border bg-card text-foreground-secondary hover:bg-surface-hover"
        href="/admin/analytics"
        prefetch={false}
      >
        <ExternalLink size={15} />
      </Link>
    </div>
  );
}

function LiveGauge({ value, totalAccounts, newThisMonth }: { value: number; totalAccounts: number; newThisMonth: number }) {
  const maximum = Math.max(6, Math.ceil(Math.max(value, 1) / 6) * 6);
  const rotation = -90 + Math.min(value / maximum, 1) * 180;

  return (
    <div className="flex h-full flex-col">
      <PanelTitle live subtitle="Database-backed active sessions" title="Current live users" />
      <div className="flex flex-1 flex-col justify-between px-4 pb-5 pt-6">
        <div className="mx-auto w-full max-w-[280px] text-center">
          <svg aria-label={`${value} live users`} className="w-full" role="img" viewBox="0 0 280 170">
            <path d="M 30 135 A 110 110 0 0 1 250 135" fill="none" stroke="var(--secondary)" strokeWidth="8" />
            <path d="M 30 135 A 110 110 0 0 1 250 135" fill="none" pathLength="100" stroke="var(--primary)" strokeDasharray={`${Math.min(value / maximum, 1) * 100} 100`} strokeWidth="8" />
            <g transform={`rotate(${rotation} 140 135)`}>
              <line stroke="var(--primary)" strokeLinecap="round" strokeWidth="4" x1="140" x2="140" y1="135" y2="55" />
            </g>
            <circle cx="140" cy="135" fill="var(--secondary)" r="9" />
            <text fill="var(--chart-label)" fontSize="11" x="27" y="153">0</text>
            <text fill="var(--chart-label)" fontSize="11" textAnchor="end" x="254" y="153">{maximum}</text>
          </svg>
          <p className="-mt-2 text-[25px] font-medium leading-none text-foreground tabular-nums">{value}</p>
        </div>
        <div className="grid grid-cols-2 gap-5 pt-5">
          <div className="border-t-[6px] border-primary pt-2.5">
            <p className="text-[12px] text-muted-foreground">Total accounts</p>
            <p className="mt-1 text-[20px] leading-none text-foreground tabular-nums">{totalAccounts}</p>
          </div>
          <div className="border-t-[6px] border-secondary pt-2.5">
            <p className="text-[12px] text-muted-foreground">New this month</p>
            <p className="mt-1 text-[20px] leading-none text-foreground tabular-nums">{newThisMonth}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const SHORTCUTS = [
  { title: "User Activity", meta: "Accounts · Access", href: "/admin/users", icon: UsersRound },
  { title: "Commerce Analytics", meta: "Orders · Inventory", href: "/admin/orders", icon: PackageCheck },
  { title: "Service Engagement", meta: "Pandits · Sessions", href: "/admin/consultations", icon: Sparkles },
  { title: "Product KPIs", meta: "Catalogue · Stock", href: "/admin/products", icon: Activity },
  { title: "Report Operations", meta: "Orders · Generation", href: "/admin/generated-reports", icon: FileChartColumn },
] as const;

function ShortcutRail() {
  return (
    <section className={`${PANEL} px-4 pb-5 pt-3.5`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
          <h2>Workspaces</h2>
          <CircleHelp className="text-muted-foreground" size={15} />
        </div>
        <Link className="rounded border border-border px-2.5 py-1 text-[10px] font-medium text-foreground-secondary hover:bg-surface-hover" href="/admin" prefetch={false}>
          See All
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-color:var(--border-strong)_transparent]">
        {SHORTCUTS.map(({ title, meta, href, icon: Icon }) => (
          <Link
            className="group flex min-w-[225px] items-center justify-between rounded-[4px] border border-border bg-muted px-4 py-3 hover:border-border-strong hover:bg-surface-hover"
            href={href}
            key={href}
            prefetch={false}
          >
            <span>
              <span className="block text-[13px] font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{meta}</span>
            </span>
            <span className="grid size-10 place-items-center rounded-[3px] border border-border bg-card text-primary shadow-sm">
              <Icon size={20} strokeWidth={1.8} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function SimpleDataPanel({
  title,
  subtitle,
  headings,
  rows,
}: {
  title: string;
  subtitle: string;
  headings: [string, string];
  rows: Array<{ label: React.ReactNode; value: React.ReactNode }>;
}) {
  return (
    <section className={`${PANEL} min-h-[230px] overflow-hidden`}>
      <PanelTitle subtitle={subtitle} title={title} />
      <div className="px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-table-border px-2 py-2 text-[11px] text-chart-label">
          <span>{headings[0]}</span><span>{headings[1]}</span>
        </div>
        <div className="divide-y divide-table-border">
          {rows.map((row, index) => (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-2 py-2.5 text-[12px]" key={index}>
              <span className="min-w-0 truncate text-primary">{row.label}</span>
              <span className="text-foreground tabular-nums">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LiveRolePanel({ rows }: { rows: SuperAdminDashboardData["liveRoles"] }) {
  const visibleRows = rows.filter((row) => row.value > 0);
  const displayRows = visibleRows.length ? visibleRows : rows.slice(0, 4);
  const maximum = Math.max(1, ...displayRows.map((row) => row.value));

  return (
    <section className={`${PANEL} min-h-[230px] overflow-hidden`}>
      <PanelTitle live subtitle="Unexpired sessions" title="Realtime users by role" />
      <div className="space-y-4 px-5 py-5">
        {displayRows.map((row) => (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>{row.label}</span><span className="font-medium tabular-nums">{row.value}</span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / maximum) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SuperAdminDashboard({ adminName, data }: { adminName: string; data: SuperAdminDashboardData }) {
  const [selectedId, setSelectedId] = useState<SuperDashboardMetric["id"]>(data.metrics[0]?.id ?? "accounts");
  const selectedMetric = data.metrics.find((metric) => metric.id === selectedId) ?? data.metrics[0];
  const generatedAt = new Date(data.generatedAt);

  return (
    <section className="min-h-[calc(100vh-var(--header-height))] bg-background-subtle px-3 pb-8 text-foreground sm:px-5">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border py-3">
        <div className="flex items-center gap-3">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12px] font-medium text-foreground-secondary [&::-webkit-details-marker]:hidden">
              Super Admin <ChevronDown className="transition group-open:rotate-180" size={14} />
            </summary>
            <div className="absolute left-0 top-8 z-20 w-52 rounded-[5px] border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
              <Link className="block rounded px-3 py-2 text-[12px] hover:bg-surface-hover" href="/admin" prefetch={false}>Operations overview</Link>
              <Link className="block rounded px-3 py-2 text-[12px] hover:bg-surface-hover" href="/admin/analytics" prefetch={false}>Full analytics</Link>
            </div>
          </details>
          <Link aria-label="System settings" className="text-foreground-secondary hover:text-primary" href="/admin/settings" prefetch={false}><Settings size={17} /></Link>
          <span className="hidden text-[11px] text-muted-foreground sm:inline">Updated {generatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })}</span>
        </div>
        <details className="group relative">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium text-foreground-secondary [&::-webkit-details-marker]:hidden">
            <ShieldCheck size={16} /> Resources <ChevronDown className="transition group-open:rotate-180" size={14} />
          </summary>
          <div className="absolute right-0 top-8 z-20 w-52 rounded-[5px] border border-border bg-popover p-1.5 text-popover-foreground shadow-lg">
            <Link className="block rounded px-3 py-2 text-[12px] hover:bg-surface-hover" href="/admin/users" prefetch={false}>Users and roles</Link>
            <Link className="block rounded px-3 py-2 text-[12px] hover:bg-surface-hover" href="/admin/audit" prefetch={false}>Audit log</Link>
            <Link className="block rounded px-3 py-2 text-[12px] hover:bg-surface-hover" href="/admin/integrations" prefetch={false}>Integrations</Link>
          </div>
        </details>
      </header>

      <div className="mx-auto mt-5 grid max-w-[1440px] gap-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,2.05fr)_minmax(300px,1fr)]">
          <section className={`${PANEL} min-h-[430px] p-4 sm:p-6`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className="flex items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground" type="button">
                Platform Engagement <ChevronDown size={14} />
              </button>
              <Link className="flex items-center gap-1.5 text-[12px] font-medium text-foreground hover:text-primary" href="/admin/analytics" prefetch={false}>
                Open Analysis <ArrowRight size={15} />
              </Link>
            </div>
            <div className="mt-4">
              <MetricSelector metrics={data.metrics} onSelect={setSelectedId} selectedId={selectedId} />
              {selectedMetric ? <EngagementChart metric={selectedMetric} /> : null}
            </div>
          </section>
          <section className={`${PANEL} min-h-[430px]`}>
            <LiveGauge newThisMonth={data.newAccountsThisMonth} totalAccounts={data.totalAccounts} value={data.liveUsers} />
          </section>
        </div>

        <ShortcutRail />

        <div className="grid gap-5 lg:grid-cols-3">
          <SimpleDataPanel
            headings={["Queue", "Volume"]}
            rows={data.queues.map((queue) => ({
              label: <Link href={queue.href} prefetch={false}>{queue.label}</Link>,
              value: queue.value,
            }))}
            subtitle="Needs review"
            title="Priority queues"
          />
          <SimpleDataPanel
            headings={["Role", "Users"]}
            rows={data.userRoles.map((role) => ({ label: role.label, value: role.value }))}
            subtitle="All accounts"
            title="Breakdown of users by role"
          />
          <LiveRolePanel rows={data.liveRoles} />
        </div>

        <UserGlobeCard error={data.geographyError} geography={data.geography} />

        <section className={`${PANEL} overflow-hidden`}>
          <PanelTitle subtitle="Most recently created accounts" title="Recent users" />
          <div className="overflow-x-auto px-4 py-3">
            <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
              <thead className="border-b border-table-border text-[11px] text-chart-label">
                <tr><th className="px-2 py-2 font-medium">Name</th><th className="px-2 py-2 font-medium">Email</th><th className="px-2 py-2 font-medium">Role</th><th className="px-2 py-2 text-right font-medium">Created</th></tr>
              </thead>
              <tbody className="divide-y divide-table-border">
                {data.recentAccounts.map((account) => (
                  <tr key={account.id}>
                    <td className="px-2 py-3 font-medium text-foreground">{account.name || "Unnamed account"}</td>
                    <td className="px-2 py-3 text-foreground-secondary">{account.email}</td>
                    <td className="px-2 py-3 text-foreground-secondary">{account.role}</td>
                    <td className="px-2 py-3 text-right text-foreground-secondary">{new Date(account.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      <p className="mx-auto mt-4 max-w-[1440px] text-right text-[10px] text-muted-foreground">Signed in as {adminName}</p>
    </section>
  );
}
