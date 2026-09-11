"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleWishlistAction } from "@/app/account/wishlist/actions";

/**
 * Save-to-wishlist control.
 *
 * Optimistic in appearance but not in truth: the icon fills immediately so the
 * interaction feels instant, and reverts if the server refuses. An anonymous
 * visitor is sent to sign in rather than being told "no" - a wishlist needs an
 * account to belong to, and that is a reason to sign up rather than an error.
 */
export function WishlistButton({
  productId,
  initialSaved,
  variant = "icon",
}: {
  productId: string;
  initialSaved: boolean;
  variant?: "icon" | "labelled";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const previous = saved;
    setSaved(!previous);
    setError(null);

    startTransition(async () => {
      const result = await toggleWishlistAction(productId, previous);

      if (!result.ok) {
        setSaved(previous);

        if (result.needsAuth) {
          router.push(`/sign-in?returnTo=${encodeURIComponent("/account/wishlist")}`);
          return;
        }

        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  if (variant === "labelled") {
    return (
      <div className="grid gap-2">
        <button
          aria-pressed={saved}
          className={cn(
            "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-5 text-sm font-semibold transition",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
            saved
              ? "border-premium/60 text-premium"
              : "border-border-strong text-foreground hover:border-primary hover:text-primary",
          )}
          disabled={pending}
          onClick={toggle}
          type="button"
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={16} />
          ) : (
            <Heart aria-hidden="true" className={cn(saved && "fill-current")} size={16} />
          )}
          {saved ? "Saved" : "Save"}
        </button>

        <div aria-live="polite">
          {error ? (
            <p className="caption text-danger" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <button
      aria-label={label}
      aria-pressed={saved}
      className={cn(
        "grid size-9 place-items-center rounded-full border transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
        saved
          ? "border-premium/60 bg-background/85 text-premium"
          : "border-border bg-background/85 text-foreground-muted hover:text-foreground",
      )}
      disabled={pending}
      onClick={toggle}
      title={label}
      type="button"
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="animate-spin" size={15} />
      ) : (
        <Heart aria-hidden="true" className={cn(saved && "fill-current")} size={15} />
      )}
    </button>
  );
}
