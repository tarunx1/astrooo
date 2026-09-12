"use client";

import { PencilLine, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BirthDetailsForm, type BirthDetailsFormDefaults } from "@/components/kundli/birth-details-form";

/**
 * Recalculate from corrected birth details without mutating the stored chart.
 *
 * A result id is a view capability, so this is intentionally available to the
 * same person who can view the result. Submitting uses the canonical Kundli
 * action and creates (or reuses) an immutable calculation snapshot.
 */
export function EditKundliDetails({ defaults }: { defaults: BirthDetailsFormDefaults }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) triggerRef.current?.focus();
      wasOpenRef.current = false;
      return;
    }

    wasOpenRef.current = true;
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        <PencilLine aria-hidden="true" size={14} />
        Edit birth details
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-background/85 p-4 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
          role="presentation"
        >
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-surface p-5 shadow-[var(--shadow-lg)] sm:p-7"
            ref={dialogRef}
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="caption uppercase tracking-[0.1em] text-premium">Recalculate Kundli</p>
                <h2 className="mt-2 heading-lg" id={titleId}>Edit birth details</h2>
                <p className="mt-2 body-sm text-foreground-secondary" id={descriptionId}>
                  Correct the details below to generate a new chart. This Kundli remains unchanged.
                </p>
              </div>
              <button
                aria-label="Close birth details editor"
                className="grid size-10 shrink-0 place-items-center rounded-md border border-border text-foreground-muted transition hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                onClick={() => setOpen(false)}
                ref={closeRef}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            <div className="mt-6 border-t border-border pt-6">
              <BirthDetailsForm
                defaults={defaults}
                pendingLabel="Recalculating Kundli..."
                submitLabel="Generate updated Kundli"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
