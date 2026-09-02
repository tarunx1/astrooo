"use client";

import { useActionState } from "react";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  confirmKundliSaveAction,
  startKundliSaveAction,
  INITIAL_SAVE_STATE,
  type SaveKundliState,
} from "@/app/kundli/result/[id]/actions";

/**
 * "Save this Kundli" affordance on a result page.
 *
 * Anonymous visitors are sent through sign-in first; the server records a
 * signed continuation cookie so the intent survives the round trip without ever
 * putting birth data in a URL. Signed-in visitors returning with a valid
 * continuation get an explicit confirm step rather than a silent auto-claim.
 */
type SaveKundliCardProps = {
  calculationId: string;
  isAuthenticated: boolean;
  isSaved: boolean;
  hasPendingContinuation: boolean;
};

export function SaveKundliCard({
  calculationId,
  isAuthenticated,
  isSaved,
  hasPendingContinuation,
}: SaveKundliCardProps) {
  const [state, formAction, pending] = useActionState<SaveKundliState, FormData>(
    isAuthenticated ? confirmKundliSaveAction : startKundliSaveAction,
    INITIAL_SAVE_STATE,
  );

  const saved = isSaved || state.saved;

  if (saved) {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-4" variant="premium">
        <BookmarkCheck aria-hidden="true" className="text-premium" size={18} />
        <p className="body-sm text-foreground">
          Saved to your account.{" "}
          <a className="font-semibold text-primary underline-offset-4 hover:underline" href="/account/kundlis">
            View saved Kundlis
          </a>
        </p>
      </Card>
    );
  }

  const prompt = isAuthenticated
    ? hasPendingContinuation
      ? "You are signed in. Save this Kundli to your account."
      : "Save this Kundli to your account."
    : "Sign in to save this Kundli to your account.";

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="flex items-center gap-3">
        <BookmarkPlus aria-hidden="true" className="shrink-0 text-foreground-muted" size={18} />
        <div>
          <p className="body-sm text-foreground">{prompt}</p>
          {state.error ? (
            <p className="mt-1 caption text-danger" role="alert">
              {state.error}
            </p>
          ) : null}
        </div>
      </div>

      <form action={formAction}>
        <input name="calculationId" type="hidden" value={calculationId} />
        <button
          className="min-h-11 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving..." : isAuthenticated ? "Save this Kundli" : "Save this Kundli"}
        </button>
      </form>
    </Card>
  );
}
