import type { Metadata } from "next";
import Link from "next/link";
import { AuditAction } from "@prisma/client";
import { AdminLayout } from "@/components/admin/admin-shell";
import { AuditTimeline, DashboardSection, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { SecretField } from "@/components/admin/secret-field";
import { requireSuperAdminViewer } from "@/lib/auth/access";
import { hasRootKey } from "@/lib/settings/crypto";
import { describeIntegrations } from "@/lib/settings/integrations";
import { ENVIRONMENT_MANAGED } from "@/lib/settings/registry";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "API keys" };
export const dynamic = "force-dynamic";

/**
 * Credential management.
 *
 * Every credential here is write-only by construction. The server sends only
 * whether one exists and where it came from, so there is nothing on this page
 * to reveal, copy or export - and no action that would return a stored value to
 * a browser. Replacing one is how you change it; there is no way to read the
 * current value back, which is the point.
 *
 * Super Admin only, and not delegable: `api_keys.manage` is in the undelegable
 * set, so an employee cannot be given it even deliberately.
 *
 * Root-of-trust values stay in the environment and are listed, never edited:
 * anything editable from a browser session is only as strong as that session.
 */
export default async function AdminApiKeysPage() {
  const viewer = await requireSuperAdminViewer();

  const [integrations, recentChanges] = await Promise.all([
    describeIntegrations(),
    prisma.auditLog.findMany({
      where: {
        action: {
          in: [AuditAction.SYSTEM_SECRET_REPLACED, AuditAction.SYSTEM_SECRET_REMOVED],
        },
      },
      select: {
        id: true,
        action: true,
        entityId: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const encryptionReady = hasRootKey();
  const editable = integrations.filter((row) => row.definition.secrets.length > 0);

  return (
    <AdminLayout
      adminName={viewer.name || viewer.email}
      currentPath="/admin/api-keys"
      description="Stored credentials are encrypted at rest and can only be replaced, never read back."
      title="API keys"
    >
      {!encryptionReady ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
          <p className="body-sm font-semibold text-rose-800">Encryption is not configured.</p>
          <p className="mt-1 body-sm text-slate-700">
            CONFIG_ENCRYPTION_KEY is not set on this deployment, so credentials cannot be stored here.
            Providers fall back to their environment variables until it is.
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="caption text-slate-600">
          There is deliberately no &ldquo;show&rdquo;, &ldquo;copy&rdquo; or &ldquo;export&rdquo; here. A
          credential you can read from a browser is a credential that can leak from a browser, so the only
          operations are replace and remove. Every change is recorded below.
        </p>
      </div>

      {editable.map((row) => (
        <DashboardSection
          description={row.definition.description}
          key={row.definition.id}
          title={row.definition.label}
        >
          <div className="grid gap-3">
            {row.definition.notImplemented ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-3 caption text-slate-700">
                No provider is implemented for this yet. A key stored now is held safely but nothing uses it.
              </p>
            ) : null}

            {row.secrets.map((secret) => (
              <SecretField
                configured={secret.configured}
                hint={
                  secret.source === "environment"
                    ? "Currently coming from the environment. Saving a value here takes precedence."
                    : undefined
                }
                key={secret.key}
                label={secret.label}
                secretKey={secret.key}
                source={secret.source}
              />
            ))}
          </div>
        </DashboardSection>
      ))}

      <DashboardSection
        description="These belong to the host and are never editable from a browser."
        title="Environment-managed"
      >
        <ul className="grid gap-2">
          {ENVIRONMENT_MANAGED.map((item) => (
            <li
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
              key={item.key}
            >
              <div>
                <p className="body-sm font-semibold text-slate-900">{item.label}</p>
                <p className="caption text-slate-500">{item.reason}</p>
              </div>
              <StatusBadge
                label={process.env[item.key]?.trim() ? "Present" : "Not set"}
                tone={process.env[item.key]?.trim() ? "positive" : "neutral"}
              />
            </li>
          ))}
        </ul>
      </DashboardSection>

      <DashboardSection
        actions={
          <Link className="text-sm font-semibold text-blue-700 underline" href="/admin/audit">
            Full audit log
          </Link>
        }
        description="Who changed which credential and when. Never what it was changed to."
        title="Recent credential changes"
      >
        <AuditTimeline
          entries={recentChanges.map((entry) => ({
            id: entry.id,
            title: entry.action === AuditAction.SYSTEM_SECRET_REPLACED ? "Replaced" : "Removed",
            detail: entry.entityId,
            actor: entry.actor.name || entry.actor.email,
            at: entry.createdAt,
            tone: entry.action === AuditAction.SYSTEM_SECRET_REPLACED ? "info" : "warning",
          }))}
        />
      </DashboardSection>
    </AdminLayout>
  );
}
