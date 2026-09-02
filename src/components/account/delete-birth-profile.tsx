"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { deleteBirthProfileAction, type AccountFormState } from "@/app/account/actions";

const INITIAL: AccountFormState = { formErrors: [], fieldErrors: {} };

/**
 * Accessible delete confirmation.
 *
 * The dialog is a focus-trapped alertdialog: it takes focus on open, restores it
 * on close, closes on Escape, and labels itself for screen readers. Deletion is
 * a two-step action and the server re-checks both ownership and the explicit
 * confirmation value.
 */
export function DeleteBirthProfileButton({ profileId, profileName }: { profileId: string; profileName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteBirthProfileAction, INITIAL);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    confirmRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

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

  useEffect(() => {
    if (!open) triggerRef.current?.focus();
  }, [open]);

  return (
    <>
      <button
        className="min-h-9 rounded-md px-3 py-2 text-xs font-semibold text-danger transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        onClick={() => setOpen(true)}
        ref={triggerRef}
        type="button"
      >
        Delete
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm">
          <div
            aria-describedby={descriptionId}
            aria-labelledby={titleId}
            aria-modal="true"
            className="w-full max-w-[var(--container-sm)] rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-lg)]"
            ref={dialogRef}
            role="alertdialog"
          >
            <h2 className="heading-md" id={titleId}>
              Delete this birth profile?
            </h2>
            <p className="mt-2 body-sm text-foreground-secondary" id={descriptionId}>
              {profileName} will be removed from your account, along with any Kundlis you saved from it. Charts already
              calculated are kept as records and are not deleted.
            </p>

            {state.formErrors.length > 0 ? (
              <p className="mt-3 caption text-danger" role="alert">
                {state.formErrors[0]}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                className="min-h-11 rounded-md border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                onClick={() => setOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <form action={formAction}>
                <input name="profileId" type="hidden" value={profileId} />
                <input name="confirm" type="hidden" value="delete" />
                <button
                  className="min-h-11 rounded-md bg-danger px-5 py-3 text-sm font-semibold text-foreground transition hover:opacity-90 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  disabled={pending}
                  ref={confirmRef}
                  type="submit"
                >
                  {pending ? "Deleting..." : "Delete profile"}
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
