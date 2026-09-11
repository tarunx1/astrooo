import { PanditOnboardingStatus } from "@prisma/client";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ONBOARDING_STEPS, STATUS_LABEL, STATUS_TONE, stepIndex } from "@/lib/pandit/onboarding";
import { StatusBadge } from "@/components/dashboard/dashboard-shell";

/**
 * Onboarding progress.
 *
 * Terminal states are deliberately off the track. A rejected or suspended
 * application is not "somewhere along the path", and drawing it there would
 * suggest it is still moving; those get an explicit notice instead.
 */
export function OnboardingProgress({ status }: { status: PanditOnboardingStatus }) {
  const current = stepIndex(status);

  if (current === -1) {
    return (
      <div
        className={cn(
          "rounded-lg border p-4",
          status === PanditOnboardingStatus.REJECTED
            ? "border-rose-200 bg-rose-50"
            : "border-amber-200 bg-amber-50",
        )}
      >
        <StatusBadge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
        <p className="mt-2 body-sm text-slate-700">
          {status === PanditOnboardingStatus.REJECTED
            ? "This application was not accepted. The reason is in your verification history."
            : status === PanditOnboardingStatus.CHANGES_REQUESTED
              ? "A reviewer has asked for corrections. Update your details and resubmit."
              : "Your listing is suspended. Support can tell you what is needed to reinstate it."}
        </p>
      </div>
    );
  }

  return (
    <ol className="grid gap-1.5">
      {ONBOARDING_STEPS.map((step, index) => {
        const done = index < current;
        const active = index === current;

        return (
          <li className="flex items-center gap-3" key={step}>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                done
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-400",
              )}
            >
              {done ? <Check size={13} /> : index + 1}
            </span>
            <span
              className={cn(
                "body-sm",
                active ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400",
              )}
            >
              {STATUS_LABEL[step]}
            </span>
            {active ? <StatusBadge label="You are here" tone="info" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** A completion bar plus the list of what is still outstanding. */
export function CompletionMeter({
  percent,
  requirements,
}: {
  percent: number;
  requirements: ReadonlyArray<{ key: string; label: string; met: boolean }>;
}) {
  const outstanding = requirements.filter((requirement) => !requirement.met);

  return (
    <div className="grid gap-3">
      <div>
        <div className="flex items-center justify-between">
          <p className="caption font-semibold uppercase tracking-wider text-slate-500">Profile completion</p>
          <p className="body-sm font-semibold tabular-nums text-slate-900">{percent}%</p>
        </div>
        <div
          aria-label={`Profile ${percent} percent complete`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
        >
          <div
            className={cn("h-full rounded-full transition-all", percent === 100 ? "bg-emerald-500" : "bg-blue-600")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {outstanding.length > 0 ? (
        <ul className="grid gap-1">
          {outstanding.map((requirement) => (
            <li className="caption text-slate-600" key={requirement.key}>
              · {requirement.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="caption text-emerald-700">Everything required is in place.</p>
      )}
    </div>
  );
}
