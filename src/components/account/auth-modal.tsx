"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Lock, Mail, X } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { buildPostLoginHref } from "@/lib/auth/return-url";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";
import { SmoothInput } from "@/components/ui/smooth-input";

export type AuthMode = "customer" | "pandit" | "team";

/**
 * The three entrances.
 *
 * A deliberate note on what this is and is not: choosing an entrance decides
 * where sign-in lands you and, for a Pandit sign-up, whether an application is
 * opened. It never decides what you may do. The role is read from the database
 * on the server after authentication, and every area authorizes independently -
 * so someone picking "Team" who is not staff simply arrives at their own
 * account. A role has never been assignable from a browser and this does not
 * change that.
 */
const MODE_COPY: Record<AuthMode, { label: string; signupTitle: string; signinTitle: string; subtitle: string; note?: string }> = {
  customer: {
    label: "Customer",
    signupTitle: "Create account",
    signinTitle: "Welcome back",
    subtitle: "Save Kundlis, revisit reports, and manage orders from one private account.",
  },
  pandit: {
    label: "Pandit",
    signupTitle: "Apply as a Pandit",
    signinTitle: "Pandit sign in",
    subtitle: "Create your account before completing the practitioner application.",
    note: "Creating an account here opens a Pandit application. You will be able to take consultations once it has been reviewed and approved.",
  },
  team: {
    label: "Team",
    signupTitle: "Team sign in",
    signinTitle: "Team sign in",
    subtitle: "Use your existing staff account to access operational tools.",
    note: "Staff accounts are created by an administrator. Sign in with the account you already have.",
  },
};

type AuthCardProps = {
  defaultTab?: "signup" | "signin";
  defaultMode?: AuthMode;
  /** Hides the entrance switcher, for pages that are already about one of them. */
  lockMode?: boolean;
  returnTo?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
  /**
   * Heading level for the card title.
   *
   * On /sign-in this card is the page's main content, so its title is the h1.
   * Inside the modal it sits under the host page's own h1 and must be an h2, or
   * the document would have two top-level headings.
   */
  headingLevel?: "h1" | "h2";
};

export function GlassAuthCard({
  defaultTab = "signup",
  defaultMode = "customer",
  lockMode = false,
  returnTo = "/",
  onClose,
  showCloseButton = false,
  headingLevel = "h2",
}: AuthCardProps) {
  const Heading = headingLevel;
  const router = useRouter();
  const [tab, setTab] = useState<"signup" | "signin">(defaultTab);
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  // Staff accounts are never self-created, so the Team entrance has no sign-up
  // half. Switching to it while on the sign-up tab moves to sign-in rather than
  // showing a form that would only ever be refused.
  const copy = MODE_COPY[mode];
  const canSignUp = mode !== "team";
  const activeTab = canSignUp ? tab : "signin";
  const title = activeTab === "signup" ? copy.signupTitle : copy.signinTitle;

  // The chosen entrance travels with the redirect so the server can send a new
  // Pandit to the application page rather than to a dashboard they cannot yet
  // reach. It is a hint about intent; the server still re-reads the real role.
  const destination = (() => {
    try {
      const url = new URL(returnTo, "https://tarun-astro.internal");
      url.searchParams.set("mode", mode);
      return `${url.pathname}${url.search}`;
    } catch {
      return returnTo;
    }
  })();

  async function handleGoogleSignIn() {
    setError(null);
    setPending("google");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: destination });
      if (result?.error) {
        setError("Google sign-in could not be completed.");
        setPending(null);
      }
    } catch {
      setError("Google sign-in is unavailable right now.");
      setPending(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("form");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    try {
      if (activeTab === "signup") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: fullName || email.split("@")[0],
        });

        if (result?.error) {
          setError(result.error.message ?? "Could not create account. Please try again.");
          setPending(null);
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
        });

        if (result?.error) {
          setError(result.error.message ?? "Invalid email or password.");
          setPending(null);
          return;
        }
      }

      onClose?.();
      router.replace(destination);
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setPending(null);
    }
  }

  return (
    <GlassCard
      variant="glass-raised"
      spotlight={false}
      className="relative z-10 my-auto h-[min(570px,calc(100dvh-1.5rem))] w-full max-w-[390px] overflow-y-auto rounded-lg border border-premium/35 bg-surface-raised/70 px-5 py-5 text-popover-foreground shadow-[0_24px_80px_rgb(0_0_0/0.42)] ring-1 ring-white/10 backdrop-blur-3xl transition-all duration-300 [scrollbar-width:none] sm:px-6 sm:py-5 [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex items-start gap-3">
        {/* Entrance switcher. Decides where you land and, for a Pandit sign-up,
            whether an application is opened - never what you may do. */}
        {!lockMode ? (
          <div
            aria-label="Account type"
            className="grid min-h-10 flex-1 grid-cols-3 gap-1 rounded-md border border-border/80 bg-background/35 p-1 backdrop-blur-xl"
            role="tablist"
          >
            {(Object.keys(MODE_COPY) as AuthMode[]).map((option) => (
              <button
                aria-selected={mode === option}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition duration-200",
                  mode === option ? "bg-background/70 text-foreground shadow-[var(--shadow-sm)]" : "text-foreground-muted hover:text-foreground",
                )}
                key={option}
                onClick={() => {
                  setMode(option);
                  setError(null);
                  if (option === "team") setTab("signin");
                }}
                role="tab"
                type="button"
              >
                {MODE_COPY[option].label}
              </button>
            ))}
          </div>
        ) : (
          <div className="min-h-10 flex-1" />
        )}

        {showCloseButton && onClose ? (
          <button
            aria-label="Close auth dialog"
            className="grid size-10 shrink-0 place-items-center rounded-md border border-border/80 bg-background/40 text-foreground-muted backdrop-blur-xl transition hover:border-premium hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-premium"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        ) : null}
      </div>

      {/* Reserve this block height so switching Customer/Pandit/Team does not resize the card. */}
      <div className="min-h-[6.75rem]">
        <Heading className={cn("text-2xl font-bold tracking-tight text-foreground", lockMode ? "mt-0" : "mt-4")}>
          {title}
        </Heading>
        <p className="mt-1.5 body-sm text-foreground-secondary">{copy.subtitle}</p>

        {copy.note ? (
          <p className="mt-4 rounded-md border border-border bg-background/35 p-3 text-xs leading-5 text-foreground-secondary backdrop-blur-lg">
            {copy.note}
          </p>
        ) : null}
      </div>

      {/* Auth mode switcher */}
      <div className="min-h-[2.75rem]">
        {canSignUp ? (
          <div className="mx-auto grid w-full max-w-64 grid-cols-2 border-b border-border text-sm font-semibold">
            <button
              className={cn(
                "border-b-2 px-4 py-2 transition",
                activeTab === "signup" ? "border-premium text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
              )}
              onClick={() => setTab("signup")}
              type="button"
            >
              {mode === "pandit" ? "Apply" : "Sign up"}
            </button>
            <button
              className={cn(
                "border-b-2 px-4 py-2 transition",
                activeTab === "signin" ? "border-premium text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"
              )}
              onClick={() => setTab("signin")}
              type="button"
            >
              Sign in
            </button>
          </div>
        ) : null}
      </div>

      {/* Error Notification */}
      {error ? (
        <p className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* Auth Form */}
      <form className="mt-2 grid gap-3" onSubmit={handleSubmit}>
        {activeTab === "signup" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SmoothInput
              aria-label="First name"
              autoComplete="given-name"
              className="form-control border-border bg-background/60 placeholder:text-foreground-secondary/85 focus:border-premium focus:outline-premium/55"
              name="firstName"
              placeholder="First name"
              required
              type="text"
            />
            <SmoothInput
              aria-label="Last name (optional)"
              autoComplete="family-name"
              className="form-control border-border bg-background/60 placeholder:text-foreground-secondary/85 focus:border-premium focus:outline-premium/55"
              name="lastName"
              placeholder="Last name"
              type="text"
            />
          </div>
        ) : null}

        {/* Email Field */}
        <div className="relative">
          <Mail aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-foreground-muted" size={17} />
          <SmoothInput
            aria-label="Email address"
            autoComplete="email"
            className="form-control border-border bg-background/60 pl-11 placeholder:text-foreground-secondary/85 focus:border-premium focus:outline-premium/55"
            name="email"
            placeholder="Enter your email"
            required
            type="email"
          />
        </div>

        {/* Password Field */}
        <div className="relative">
          <Lock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-foreground-muted" size={17} />
          <SmoothInput
            aria-label="Password"
            autoComplete={activeTab === "signup" ? "new-password" : "current-password"}
            className="form-control border-border bg-background/60 pl-11 placeholder:text-foreground-secondary/85 focus:border-premium focus:outline-premium/55"
            name="password"
            placeholder={activeTab === "signup" ? "Create a password" : "Enter your password"}
            required
            type="password"
          />
        </div>

        {/* Primary Action Button */}
        <button
          className="mt-1 min-h-11 w-full rounded-md bg-premium text-sm font-semibold text-background shadow-[var(--shadow-md)] transition hover:opacity-95 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-premium disabled:opacity-50"
          disabled={pending !== null}
          type="submit"
        >
          {pending === "form"
            ? "Processing..."
            : activeTab === "signup"
              ? copy.signupTitle
              : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-secondary">
          OR SIGN IN WITH
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Social sign-in. Google is the only configured provider, so it is the
          only one offered: a button for a provider that is not wired would
          either fail or quietly sign the visitor in with something else. */}
      <div className="grid gap-3">
        <button
          className="flex min-h-11 items-center justify-center gap-3 rounded-md border border-border-strong bg-surface-raised text-sm font-semibold text-foreground transition hover:border-premium hover:bg-surface-hover focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-premium disabled:opacity-50"
          disabled={pending !== null}
          onClick={handleGoogleSignIn}
          type="button"
        >
          <GoogleLogo />
          Continue with Google
        </button>
      </div>

      {/* Footer Terms */}
      <p className="mt-6 pb-1 text-center text-xs leading-5 text-foreground-muted">
        By creating an account, you agree to our{" "}
        <a className="text-foreground-secondary underline transition hover:text-foreground" href="/terms">
          Terms of Service
        </a>
        {" "}and{" "}
        <a className="text-foreground-secondary underline transition hover:text-foreground" href="/privacy">
          Privacy Policy
        </a>
      </p>
    </GlassCard>
  );
}

type AuthModalProps = {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "signup" | "signin";
  returnTo?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AuthModal({ isOpen, onClose, defaultTab = "signup", returnTo = buildPostLoginHref("/") }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Locks background scroll, closes on Escape, and keeps keyboard focus inside
  // the dialog. Without the trap, tabbing walks out into the page behind the
  // overlay, which a keyboard or screen-reader user cannot see is still there.
  useEffect(() => {
    if (!isOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Remember where focus came from so it can be handed back on close.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusFirst = window.setTimeout(() => {
      const target = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (target ?? dialogRef.current)?.focus();
    }, 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusFirst);
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-label="Sign in or create an account"
      aria-modal="true"
      className="fixed inset-0 z-[100] isolate flex min-h-dvh items-center justify-center overflow-y-auto overscroll-contain p-3 sm:p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      {/* Dimmed backdrop overlay. Decorative: the close button is the labelled control. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-background/55 backdrop-blur-md backdrop-saturate-150 transition-all duration-300"
        onClick={onClose}
      />

      <GlassAuthCard
        defaultTab={defaultTab}
        returnTo={returnTo}
        onClose={onClose}
        showCloseButton={true}
      />
    </div>,
    document.body,
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
      <path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
        fill="#34A853"
      />
      <path d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" fill="#FBBC05" />
      <path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
        fill="#EA4335"
      />
    </svg>
  );
}
