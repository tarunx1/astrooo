"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ConsultationMode } from "@prisma/client";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Directory filters.
 *
 * State lives in the URL, not in this component. That is what makes a filtered
 * view shareable and indexable - `/consultations?language=Punjabi` is a real
 * page, rendered on the server - and it means the back button works the way a
 * visitor expects.
 *
 * Only the search box is interactive enough to need debouncing; a select that
 * fires on change is already one navigation per deliberate act.
 */
const MODE_LABEL: Record<ConsultationMode, string> = {
  [ConsultationMode.CHAT]: "Chat",
  [ConsultationMode.VOICE_CALL]: "Voice call",
  [ConsultationMode.VIDEO_CALL]: "Video call",
};

const SEARCH_DEBOUNCE_MS = 350;

export type DirectoryFacets = {
  languages: string[];
  expertise: string[];
  modes: ConsultationMode[];
  maxRatePaise: number | null;
};

export function DirectoryFilters({
  facets,
  current,
}: {
  facets: DirectoryFacets;
  current: {
    q?: string;
    language?: string;
    expertise?: string;
    mode?: string;
    maxRate?: string;
    available?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(current.q ?? "");

  // Tracks whether the user is the one changing the box. Without this, a
  // navigation that rewrites `q` would fight whatever they are mid-way through
  // typing.
  const typing = useRef(false);

  useEffect(() => {
    if (!typing.current) setQuery(current.q ?? "");
  }, [current.q]);

  function push(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // Any filter change returns to the first page; staying on page 4 of a
    // result set that no longer has four pages shows an empty screen.
    params.delete("page");

    const next = params.toString();
    startTransition(() => {
      router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
    });
  }

  function setParam(key: string, value: string | undefined) {
    push((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
  }

  useEffect(() => {
    if (!typing.current) return;

    const timer = window.setTimeout(() => {
      typing.current = false;
      setParam("q", query.trim() || undefined);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
    // `setParam` is stable enough for this effect's purpose; re-running on
    // every render would reset the debounce on each keystroke's re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const hasFilters = Boolean(
    current.q || current.language || current.expertise || current.mode || current.maxRate || current.available,
  );

  const selectClass =
    "form-control min-h-11 w-full";

  return (
    <Card className={cn("p-4 sm:p-5", isPending && "opacity-70")}>
      <search className="grid gap-4">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted"
            size={17}
          />
          <label className="sr-only" htmlFor="pandit-search">
            Search practitioners by name, specialisation or language
          </label>
          <input
            autoComplete="off"
            className="form-control min-h-12 w-full pl-11 pr-11"
            id="pandit-search"
            onChange={(event) => {
              typing.current = true;
              setQuery(event.target.value);
            }}
            placeholder="Search by name, specialisation or city"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="Clear search"
              className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-foreground-muted transition hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => {
                typing.current = false;
                setQuery("");
                setParam("q", undefined);
              }}
              type="button"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1.5 block caption text-foreground-muted" htmlFor="filter-expertise">
            Specialisation
          </label>
          <select
            className={selectClass}
            id="filter-expertise"
            onChange={(event) => setParam("expertise", event.target.value || undefined)}
            value={current.expertise ?? ""}
          >
            <option value="">All specialisations</option>
            {facets.expertise.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block caption text-foreground-muted" htmlFor="filter-language">
            Language
          </label>
          <select
            className={selectClass}
            id="filter-language"
            onChange={(event) => setParam("language", event.target.value || undefined)}
            value={current.language ?? ""}
          >
            <option value="">All languages</option>
            {facets.languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block caption text-foreground-muted" htmlFor="filter-mode">
            Consultation type
          </label>
          <select
            className={selectClass}
            id="filter-mode"
            onChange={(event) => setParam("mode", event.target.value || undefined)}
            value={current.mode ?? ""}
          >
            <option value="">Any type</option>
            {facets.modes.map((mode) => (
              <option key={mode} value={mode}>
                {MODE_LABEL[mode]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block caption text-foreground-muted" htmlFor="filter-rate">
            Maximum rate
          </label>
          <select
            className={selectClass}
            id="filter-rate"
            onChange={(event) => setParam("maxRate", event.target.value || undefined)}
            value={current.maxRate ?? ""}
          >
            <option value="">Any rate</option>
            {[1000, 2500, 5000, 10000, 25000].map((paise) => (
              <option key={paise} value={paise}>
                Up to ₹{(paise / 100).toFixed(0)}
              </option>
            ))}
          </select>
        </div>
      </div>

        <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 body-sm text-foreground-secondary">
          <input
            checked={current.available === "1"}
            className="size-4 accent-[var(--primary)]"
            onChange={(event) => setParam("available", event.target.checked ? "1" : undefined)}
            type="checkbox"
          />
          Only practitioners with published availability
        </label>

        {hasFilters ? (
          <button
            className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-md border border-border px-3 caption font-semibold text-foreground-secondary transition hover:border-border-strong hover:text-foreground focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => {
              typing.current = false;
              setQuery("");
              startTransition(() => router.push(pathname, { scroll: false }));
            }}
            type="button"
          >
            <X size={13} />
            Clear all
          </button>
        ) : null}
        </div>
      </search>
    </Card>
  );
}
