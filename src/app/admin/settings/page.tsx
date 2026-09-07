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
  { href: "/admin/settings/ai", title: "AI", description: "Report generation provider, model and limits." },
  { href: "/admin/settings/astrology", title: "Astrology", description: "Calculation provider access and timeouts." },
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
          <h2 className="heading-md" id="runtime-heading">
            Runtime
          </h2>
          <Card className="mt-3 divide-y divide-border">
            <div className="flex items-center justify-between gap-4 p-4">
              <span className="body-sm text-foreground">Database</span>
              <AdminStatusBadge label={database ? "Ready" : "Unavailable"} tone={database ? "positive" : "danger"} />
            </div>
            <div className="flex items-center justify-between gap-4 p-4">
              <span className="body-sm text-foreground">Credential encryption</span>
              <AdminStatusBadge
                label={hasRootKey() ? "Configured" : "Missing"}
                tone={hasRootKey() ? "positive" : "danger"}
              />
            </div>
          </Card>
          {!hasRootKey() ? (
            <p className="mt-3 body-sm text-foreground-secondary">
              Credentials cannot be stored here until an encryption key is set on the deployment. Provider
              configuration falls back to environment variables in the meantime.
            </p>
          ) : null}
        </section>

        <section aria-labelledby="integrations-heading">
          <h2 className="heading-md" id="integrations-heading">
            Integrations
          </h2>
          <Card className="mt-3 divide-y divide-border">
            {integrations.map(({ label, status }) => (
              <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={label}>
                <div className="min-w-0">
                  <p className="body-sm text-foreground">{label}</p>
                  <p className="caption text-foreground-muted">
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
          <h2 className="heading-md" id="environment-heading">
            Environment managed
          </h2>
          <p className="mt-2 body-sm text-foreground-secondary">
            These belong to the deployment and cannot be viewed or edited here. Anything editable from a browser
            session is only as strong as that session, and these are what the session itself rests on.
          </p>
          <Card className="mt-3 divide-y divide-border">
            {ENVIRONMENT_MANAGED.map((item) => {
              const present = envPresent(item.key);
              return (
                <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={item.key}>
                  <div className="min-w-0">
                    <p className="body-sm text-foreground">{item.label}</p>
                    <p className="caption text-foreground-muted">{item.reason}</p>
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
          <h2 className="heading-md" id="areas-heading">
            Settings
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SETTINGS_AREAS.map((area) => (
              <Card className="p-4" key={area.href} variant="interactive">
                <Link className="block" href={area.href}>
                  <p className="heading-sm">{area.title}</p>
                  <p className="mt-1 body-sm text-foreground-secondary">{area.description}</p>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
