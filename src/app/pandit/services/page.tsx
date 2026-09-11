import type { Metadata } from "next";
import { ConsultationMode, RateType } from "@prisma/client";
import { DashboardSection } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import { ServiceRateForm } from "@/components/pandit/pandit-forms";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { getSettings } from "@/lib/settings/service";
import { MODE_LABEL } from "@/lib/pandit/catalog";
import { prisma } from "@/lib/db/prisma";
import { saveServiceAction } from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Services and rates" };

/**
 * Consultation types and their rates.
 *
 * The platform's allowed types and rate bounds are read here and shown, but
 * they are enforced on save rather than by the form: a bound that only exists
 * in a `min` attribute is a suggestion.
 */
export default async function PanditServicesPage() {
  const identity = await requireApprovedPandit("/pandit/services");

  const [services, settings] = await Promise.all([
    prisma.panditService.findMany({
      where: { panditProfileId: identity.profileId },
      select: { mode: true, enabled: true, rateType: true, ratePaise: true, sessionMinutes: true },
    }),
    getSettings([
      "consultations.allowedModes",
      "consultations.minRatePaise",
      "consultations.maxRatePaise",
      "consultations.enabled",
    ]),
  ]);

  const byMode = new Map(services.map((service) => [service.mode, service]));
  const allowed = settings["consultations.allowedModes"];

  const bounds = {
    minRupees: (settings["consultations.minRatePaise"] / 100).toFixed(2),
    maxRupees: (settings["consultations.maxRatePaise"] / 100).toFixed(2),
  };

  return (
    <PanditLayout
      currentPath="/pandit/services"
      description="Choose what you offer and what you charge. Rates apply to new bookings only."
      eyebrow="Services"
      identity={identity}
      title="Services and rates"
    >
      {!settings["consultations.enabled"] ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="body-sm text-slate-800">
            Consultations are currently closed platform-wide. You can still set your rates; bookings will open
            when the platform reopens them.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(ConsultationMode).map((mode) => {
          const service = byMode.get(mode);
          const offered = allowed.includes(mode);

          return (
            <DashboardSection key={mode} title={MODE_LABEL[mode]}>
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
                {offered ? (
                  <ServiceRateForm
                    action={saveServiceAction}
                    bounds={bounds}
                    defaults={{
                      enabled: service?.enabled ?? false,
                      rateType: service?.rateType ?? RateType.PER_MINUTE,
                      rateRupees: service ? (service.ratePaise / 100).toFixed(2) : "",
                      sessionMinutes: service?.sessionMinutes ? String(service.sessionMinutes) : "",
                    }}
                    mode={mode}
                  />
                ) : (
                  <p className="body-sm text-slate-600">
                    The platform is not currently offering {MODE_LABEL[mode].toLowerCase()} consultations.
                  </p>
                )}
              </div>
            </DashboardSection>
          );
        })}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="caption text-slate-600">
          Voice and video sessions need a calling provider, which is not yet connected. Rates and bookings work
          now; the call itself will start from the consultation once a provider is configured.
        </p>
      </div>
    </PanditLayout>
  );
}
