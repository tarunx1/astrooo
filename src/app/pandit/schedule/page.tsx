import type { Metadata } from "next";
import { DashboardSection, EmptyState, StatusBadge } from "@/components/dashboard/dashboard-shell";
import { PanditLayout } from "@/components/pandit/pandit-shell";
import {
  ScheduleExceptionForm,
  ScheduleRuleForm,
  SimpleActionForm,
  formatWindow,
} from "@/components/pandit/pandit-forms";
import { requireApprovedPandit } from "@/lib/pandit/guard";
import { WEEKDAY_LABELS, formatMinutes } from "@/lib/pandit/catalog";
import { prisma } from "@/lib/db/prisma";
import {
  addScheduleRuleAction,
  removeScheduleExceptionAction,
  removeScheduleRuleAction,
  saveScheduleExceptionAction,
} from "@/app/pandit/actions";

export const metadata: Metadata = { title: "Schedule" };

/**
 * Weekly availability and date exceptions.
 *
 * Windows are stored as minutes from local midnight in the Pandit's own
 * timezone, so "Monday 09:00" means nine in the morning to them all year
 * without anyone storing an offset that goes stale across a clock change.
 */
export default async function PanditSchedulePage() {
  const identity = await requireApprovedPandit("/pandit/schedule");

  // Yesterday, so an exception saved for today is still listed after midnight
  // UTC. Computed once before the queries rather than inside each of them.
  const since = new Date();
  since.setDate(since.getDate() - 1);

  const [profile, rules, exceptions] = await Promise.all([
    prisma.panditProfile.findUnique({
      where: { id: identity.profileId },
      select: { timezone: true },
    }),
    prisma.panditScheduleRule.findMany({
      where: { panditProfileId: identity.profileId },
      select: { id: true, weekday: true, startMinute: true, endMinute: true },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
    prisma.panditScheduleException.findMany({
      where: { panditProfileId: identity.profileId, date: { gte: since } },
      select: { id: true, date: true, available: true, startMinute: true, endMinute: true, note: true },
      orderBy: { date: "asc" },
      take: 60,
    }),
  ]);

  const byWeekday = new Map<number, typeof rules>();
  for (const rule of rules) {
    byWeekday.set(rule.weekday, [...(byWeekday.get(rule.weekday) ?? []), rule]);
  }

  return (
    <PanditLayout
      currentPath="/pandit/schedule"
      description={`All times are in ${profile?.timezone ?? "Asia/Kolkata"}, your own timezone.`}
      eyebrow="Schedule"
      identity={identity}
      title="When you are available"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <DashboardSection description="Repeats every week." title="Weekly availability">
          <div className="grid gap-2">
            {WEEKDAY_LABELS.map((label, weekday) => {
              const dayRules = byWeekday.get(weekday) ?? [];

              return (
                <div
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
                  key={label}
                >
                  <p className="w-24 shrink-0 body-sm font-semibold text-slate-900">{label}</p>

                  {dayRules.length === 0 ? (
                    <p className="caption text-slate-400">Unavailable</p>
                  ) : (
                    <ul className="flex flex-wrap items-center gap-2">
                      {dayRules.map((rule) => (
                        <li className="flex items-center gap-2" key={rule.id}>
                          <StatusBadge
                            label={formatWindow(rule.startMinute, rule.endMinute)}
                            tone="info"
                          />
                          <SimpleActionForm
                            action={removeScheduleRuleAction}
                            hidden={{ ruleId: rule.id }}
                            label="Remove"
                            pendingLabel="..."
                            variant="secondary"
                          />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </DashboardSection>

        <div className="grid gap-4 self-start">
          <DashboardSection
            description="Overlapping windows on the same day are merged."
            title="Add a window"
          >
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <ScheduleRuleForm action={addScheduleRuleAction} />
            </div>
          </DashboardSection>

          <DashboardSection description="Block a day, or open one outside your usual hours." title="Specific dates">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
              <ScheduleExceptionForm action={saveScheduleExceptionAction} />
            </div>
          </DashboardSection>
        </div>
      </div>

      <DashboardSection title="Upcoming exceptions">
        {exceptions.length === 0 ? (
          <EmptyState
            description="Block a holiday or add extra hours using the form above."
            title="No date exceptions"
          />
        ) : (
          <ul className="grid gap-2">
            {exceptions.map((exception) => (
              <li
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs"
                key={exception.id}
              >
                <p className="body-sm font-semibold text-slate-900">
                  {exception.date.toISOString().slice(0, 10)}
                </p>
                <StatusBadge
                  label={exception.available ? "Extra availability" : "Blocked"}
                  tone={exception.available ? "positive" : "neutral"}
                />
                {exception.startMinute !== null && exception.endMinute !== null ? (
                  <span className="caption text-slate-500">
                    {formatMinutes(exception.startMinute)} – {formatMinutes(exception.endMinute)}
                  </span>
                ) : null}
                {exception.note ? <span className="caption text-slate-500">{exception.note}</span> : null}
                <div className="ml-auto">
                  <SimpleActionForm
                    action={removeScheduleExceptionAction}
                    hidden={{ exceptionId: exception.id }}
                    label="Remove"
                    pendingLabel="..."
                    variant="secondary"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </DashboardSection>
    </PanditLayout>
  );
}
