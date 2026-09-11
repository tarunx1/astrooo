import Link from "next/link";
import Image from "next/image";
import { ConsultationMode } from "@prisma/client";
import { BadgeCheck, CalendarCheck, MessageSquare, Phone, Star, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatMoneyMinor } from "@/lib/shop/pricing";
import type { DirectoryPandit } from "@/lib/consultations/directory";

/**
 * A practitioner card.
 *
 * Two things it deliberately does not do: invent a rating, and imply
 * availability it has not checked. A Pandit nobody has reviewed shows "New" -
 * not four stars, and not zero - because a fabricated default would be worse
 * than an honest absence for the first customer deciding who to trust.
 */
const MODE_ICON = {
  [ConsultationMode.CHAT]: MessageSquare,
  [ConsultationMode.VOICE_CALL]: Phone,
  [ConsultationMode.VIDEO_CALL]: Video,
} as const;

const MODE_SHORT = {
  [ConsultationMode.CHAT]: "Chat",
  [ConsultationMode.VOICE_CALL]: "Voice",
  [ConsultationMode.VIDEO_CALL]: "Video",
} as const;

/** Renders a rate the way it is actually charged, never as a bare number. */
export function formatRate(service: DirectoryPandit["services"][number]): string {
  const amount = formatMoneyMinor(service.ratePaise, "INR");
  if (service.rateType === "PER_MINUTE") return `${amount}/min`;
  return service.sessionMinutes ? `${amount} / ${service.sessionMinutes} min` : amount;
}

export function RatingDisplay({
  rating,
  reviewCount,
  size = "sm",
}: {
  rating: number | null;
  reviewCount: number;
  size?: "sm" | "md";
}) {
  if (rating === null) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-foreground-muted", size === "md" ? "body-sm" : "caption")}>
        <Star aria-hidden="true" size={size === "md" ? 15 : 13} />
        New practitioner
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-premium", size === "md" ? "body-sm" : "caption")}>
      <Star aria-hidden="true" className="fill-current" size={size === "md" ? 15 : 13} />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      <span className="text-foreground-muted">
        ({reviewCount} review{reviewCount === 1 ? "" : "s"})
      </span>
    </span>
  );
}

export function PanditCard({ pandit }: { pandit: DirectoryPandit }) {
  const cheapest = [...pandit.services].sort((a, b) => a.ratePaise - b.ratePaise)[0];

  return (
    <Card className="group flex h-full flex-col overflow-hidden" variant="interactive">
      <Link
        className="flex h-full flex-col p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        href={`/consultations/${pandit.slug}`}
        prefetch={false}
      >
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-surface-raised">
            {pandit.profileImageUrl ? (
              <Image
                alt=""
                className="size-full object-cover"
                height={128}
                src={pandit.profileImageUrl}
                width={128}
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid size-full place-items-center text-lg font-semibold text-foreground-muted"
              >
                {pandit.displayName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate heading-sm text-foreground">{pandit.displayName}</h3>
              {pandit.verified ? (
                <BadgeCheck aria-label="Verified practitioner" className="shrink-0 text-accent-cyan" size={16} />
              ) : null}
            </div>

            {pandit.headline ? (
              <p className="mt-0.5 line-clamp-1 caption text-foreground-secondary">{pandit.headline}</p>
            ) : null}

            <div className="mt-1.5">
              <RatingDisplay rating={pandit.rating} reviewCount={pandit.reviewCount} />
            </div>
          </div>
        </div>

        <dl className="mt-4 grid gap-1.5">
          {pandit.expertise.length > 0 ? (
            <div className="flex gap-2">
              <dt className="sr-only">Specialisations</dt>
              <dd className="line-clamp-1 caption text-foreground-secondary">
                {pandit.expertise.slice(0, 3).join(" · ")}
              </dd>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-x-3 gap-y-1 caption text-foreground-muted">
            {pandit.yearsOfExperience !== null ? (
              <span>
                <dt className="sr-only">Experience</dt>
                <dd className="inline">{pandit.yearsOfExperience} yrs experience</dd>
              </span>
            ) : null}
            {pandit.languages.length > 0 ? (
              <span>
                <dt className="sr-only">Languages</dt>
                <dd className="inline">{pandit.languages.slice(0, 3).join(", ")}</dd>
              </span>
            ) : null}
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          {pandit.services.map((service) => {
            const Icon = MODE_ICON[service.mode];
            return (
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 caption text-foreground-secondary"
                key={service.mode}
              >
                <Icon aria-hidden="true" size={12} />
                {MODE_SHORT[service.mode]}
              </span>
            );
          })}
        </div>

        <div className="mt-3 flex items-end justify-between gap-3 border-t border-border pt-3">
          {cheapest ? (
            <p className="body-sm">
              <span className="caption text-foreground-muted">from </span>
              <span className="font-semibold text-foreground">{formatRate(cheapest)}</span>
            </p>
          ) : (
            <p className="caption text-foreground-muted">Rates on profile</p>
          )}

          {pandit.hasAvailability ? (
            <span className="inline-flex items-center gap-1.5 caption text-success">
              <CalendarCheck aria-hidden="true" size={13} />
              Taking bookings
            </span>
          ) : (
            <span className="caption text-foreground-muted">No slots listed</span>
          )}
        </div>
      </Link>
    </Card>
  );
}

export function PanditGrid({ pandits }: { pandits: readonly DirectoryPandit[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pandits.map((pandit) => (
        <li className="h-full" key={pandit.id}>
          <PanditCard pandit={pandit} />
        </li>
      ))}
    </ul>
  );
}
