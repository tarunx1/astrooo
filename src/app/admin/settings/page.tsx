import type { Metadata } from "next";
import Link from "next/link";
import { AdminLayout, AdminStatusBadge } from "@/components/admin/admin-shell";
import { Card } from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth/admin";
import { hasRootKey } from "@/lib/settings/crypto";
import { ENVIRONMENT_MANAGED } from "@/lib/settings/registry";
import { getAIStatus, getAstrologyStatus, getRazorpayStatus } from "@/lib/settings/providers";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "System" };
export const dynamic = "force-dynamic";

/** Never a value, a host or a connection string. Only whether it is present. */
function envPresent(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

async function databaseReady(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const SETTINGS_AREAS = [
  { href: "/admin/settings/site", title: "Site", description: "Name, contact details and the announcement banner." },
  { href: "/admin/settings/payments", title: "Payments", description: "Razorpay credentials, mode and acceptance." },
  { href: "/admin/settings/ai", title: "AI", description: "Report generation provider, model and limits.", planned: true },
  { href: "/admin/settings/astrology", title: "Astrology", description: "Calculation provider access and timeouts.", planned: true },
];

export default async function AdminSystemPage() {
  const admin = await requireSuperAdmin();

  const [database, razorpay, ai, astrology] = await Promise.all([
    databaseReady(),
    getRazorpayStatus(),
    getAIStatus(),
    getAstrologyStatus(),
  ]);

  const integrations = [
    { label: "Razorpay", status: razorpay },
    { label: "AI provider", status: ai },
    { label: "Astrology provider", status: astrology },
  ];

  return (
    <AdminLayout
      adminName={admin.name || admin.email}
      currentPath="/admin/settings"
      description="Configuration you can change here, and the values that stay with the deployment."
      title="System"
    >
      <div className="grid gap-6">
        <section aria-labelledby="runtime-heading">
          <h2 className="heading-md text-slate-900" id="runtime-heading">
            Runtime
          </h2>
          <Card className="mt-3 divide-y divide-slate-100" variant="admin">
            <div className="flex items-center justify-between gap-4 p-4">
              <span className="body-sm text-slate-800">Database</span>
              <AdminStatusBadge label={database ? "Ready" : "Unavailable"} tone={database ? "positive" : "danger"} />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <span className="body-sm text-slate-800">Credential encryption</span>
              <AdminStatusBadge
                label={hasRootKey() ? "Configured" : "Missing"}
                tone={hasRootKey() ? "positive" : "danger"}
              />
            </div>
          </Card>
          {!hasRootKey() ? (
            <p className="mt-3 body-sm text-slate-600">
              Credentials cannot be stored here until an encryption key is set on the deployment. Provider
              configuration falls back to environment variables in the meantime.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="integrations-heading">
          <h2 className="heading-md text-slate-900" id="integrations-heading">
            Integrations
          </h2>
          <Card className="mt-3 divide-y divide-slate-100" variant="admin">
            {integrations.map(({ label, status }) => (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={label}>
                <div className="min-w-0">
                  <p className="body-sm font-medium text-slate-800">{label}</p>
                  <p className="caption text-slate-500">
                    {status.configured
                      ? `${status.source === "admin" ? "Configured here" : status.source === "environment" ? "Configured via environment" : status.source === "built-in" ? "Built in, nothing to configure" : "Available"}${status.detail ? ` · ${status.detail}` : ""}`
                      : "Not configured"}
                  </p>
                </div>
                <AdminStatusBadge
                  label={!status.configured ? "Missing" : status.enabled ? "Enabled" : "Configured · off"}
                  tone={!status.configured ? "neutral" : status.enabled ? "positive" : "neutral"}
                />
              </div>
            ))}
          </Card>
        </section>

        <section aria-labelledby="environment-heading">
          <h2 className="heading-md text-slate-900" id="environment-heading">
            Environment managed
          </h2>
          <p className="mt-2 body-sm text-slate-600">
            These belong to the deployment and cannot be viewed or edited here. Anything editable from a browser
            session is only as strong as that session, and these are what the session itself rests on.
          </p>
          <Card className="mt-3 divide-y divide-slate-100" variant="admin">
            {ENVIRONMENT_MANAGED.map((item) => {
              const present = envPresent(item.key);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={item.key}>
                  <div className="min-w-0">
                    <p className="body-sm font-medium text-slate-800">{item.label}</p>
                    <p className="caption text-slate-500">{item.reason}</p>
                  </div>
                  <AdminStatusBadge
                    label={present ? "Configured" : "Missing"}
                    tone={present ? "positive" : "neutral"}
                  />
                </div>
              );
            })}
          </Card>
        </section>

        <section aria-labelledby="areas-heading">
          <h2 className="heading-md text-slate-900" id="areas-heading">
            Settings
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SETTINGS_AREAS.map((area) => (
              <Card className="p-4" key={area.href} variant={area.planned ? "admin" : "admin-interactive"}>
                {area.planned ? (
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="heading-sm text-slate-500">{area.title}</p>
                      <span className="rounded-sm bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Managed in .env</span>
                    </div>
                    <p className="mt-1 body-sm text-slate-400">{area.description}</p>
                  </div>
                ) : (
                  <Link className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" href={area.href}>
                    <p className="heading-sm text-slate-900">{area.title}</p>
                    <p className="mt-1 body-sm text-slate-600">{area.description}</p>
                  </Link>
                )}
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
