"use client";

import dynamic from "next/dynamic";
import { CircleHelp, MapPin } from "lucide-react";
import type { GeographySummary } from "@/lib/analytics/geography";

const UserGlobe = dynamic(
  () => import("@/components/analytics/user-globe").then((module) => module.UserGlobe),
  {
    ssr: false,
    loading: () => <div aria-label="Loading globe" className="aspect-square w-full max-w-[640px] animate-pulse rounded-full bg-muted" role="status" />,
  },
);

export function UserGlobeCard({
  geography,
  error = false,
}: {
  geography: GeographySummary | null;
  error?: boolean;
}) {
  const topLocations = geography?.markers.slice(0, 5) ?? [];

  return (
    <section className="overflow-hidden rounded-[5px] border border-border bg-card shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-6">
        <div>
          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground">
            <h2>Global User Distribution</h2>
            <CircleHelp aria-label="About Global User Distribution" className="text-muted-foreground" size={15} />
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">City-level distribution from owned customer profiles</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[10px] font-medium text-foreground-secondary">
          <MapPin size={12} /> Privacy-safe aggregation
        </span>
      </div>

      {error ? (
        <div className="grid min-h-[280px] place-items-center px-6 text-center text-sm text-muted-foreground" role="alert">
          User geography is temporarily unavailable. The rest of the dashboard is unaffected.
        </div>
      ) : !geography || geography.markers.length === 0 ? (
        <div className="grid min-h-[280px] place-items-center px-6 text-center text-sm text-muted-foreground">
          No user location data available yet.
        </div>
      ) : (
        <div className="grid items-center gap-2 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(230px,0.75fr)]">
          <UserGlobe markers={geography.markers} />
          <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Top user locations</h3>
            <ol className="mt-3 divide-y divide-table-border" aria-label="Top user locations">
              {topLocations.map((marker, index) => (
                <li className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 py-3 text-[12px]" key={marker.id}>
                  <span className="text-muted-foreground tabular-nums">{index + 1}</span>
                  <span className="min-w-0 truncate text-foreground">
                    {marker.city ?? marker.region ?? marker.country}
                    {marker.city ? <span className="text-muted-foreground"> · {marker.country}</span> : null}
                  </span>
                  <strong className="font-medium text-foreground tabular-nums">{marker.count.toLocaleString("en-IN")}</strong>
                </li>
              ))}
            </ol>
            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5">
              {[
                ["Countries", geography.countryCount],
                ["Cities", geography.cityCount],
                ["Users mapped", geography.mappedUsers],
                ["Unmapped users", geography.unmappedUsers],
              ].map(([label, value]) => (
                <div className="rounded border border-border bg-muted px-3 py-2.5" key={label}>
                  <dt className="text-[10px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-[17px] text-foreground tabular-nums">{Number(value).toLocaleString("en-IN")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}
    </section>
  );
}
