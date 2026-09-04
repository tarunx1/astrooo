"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, X } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";

type AuthCardProps = {
  defaultTab?: "signup" | "signin";
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
  returnTo = "/",
  onClose,
  showCloseButton = false,
  headingLevel = "h2",
}: AuthCardProps) {
  const Heading = headingLevel;
  const router = useRouter();
  const [tab, setTab] = useState<"signup" | "signin">(defaultTab);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setPending("google");
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: returnTo });
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
      if (tab === "signup") {
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
      router.replace(returnTo);
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
      className="relative z-10 my-auto max-h-[calc(100vh-3rem)] w-full max-w-[400px] overflow-y-auto rounded-[28px] border border-white/10 bg-[#141824]/90 p-7 shadow-[0_24px_80px_0_rgba(0,0,0,0.85)] backdrop-blur-3xl transition-all duration-300 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* Close Button (X) */}
      {showCloseButton && onClose ? (
        <button
          aria-label="Close auth dialog"
          className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground-muted transition hover:bg-white/15 hover:text-white"
          onClick={onClose}
          type="button"
        >
          <X size={17} />
        </button>
      ) : null}

      {/* Tab Switcher Pill */}
      <div className="inline-flex rounded-full border border-white/10 bg-[#0b0e17] p-1">
        <button
          className={cn(
            "rounded-full px-5 py-2 text-sm font-semibold transition duration-200",
            tab === "signup" ? "bg-[#252b3d] text-white shadow-sm" : "text-foreground-muted hover:text-white"
          )}
          onClick={() => setTab("signup")}
          type="button"
        >
          Sign up
        </button>
        <button
          className={cn(
            "rounded-full px-5 py-2 text-sm font-semibold transition duration-200",
            tab === "signin" ? "bg-[#252b3d] text-white shadow-sm" : "text-foreground-muted hover:text-white"
          )}
          onClick={() => setTab("signin")}
          type="button"
        >
          Sign in
        </button>
      </div>

      {/* Title Header */}
      <Heading className="mt-6 text-2xl font-bold tracking-tight text-white">
        {tab === "signup" ? "Create an account" : "Welcome back"}
      </Heading>

      {/* Error Notification */}
      {error ? (
        <p className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {/* Auth Form */}
      <form className="mt-6 grid gap-3.5" onSubmit={handleSubmit}>
        {tab === "signup" ? (
          <div className="grid grid-cols-2 gap-3">
            <input
              autoComplete="given-name"
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#1e2333]/60 px-4 text-sm text-white placeholder-foreground-muted/50 outline-none transition focus:border-white/30 focus:bg-[#1e2333]"
              name="firstName"
              placeholder="First name"
              required
              type="text"
            />
            <input
              autoComplete="family-name"
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#1e2333]/60 px-4 text-sm text-white placeholder-foreground-muted/50 outline-none transition focus:border-white/30 focus:bg-[#1e2333]"
              name="lastName"
              placeholder="Last name"
              type="text"
            />
          </div>
        ) : null}

        {/* Email Field */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted/60" size={17} />
          <input
            autoComplete="email"
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#1e2333]/60 pl-11 pr-4 text-sm text-white placeholder-foreground-muted/50 outline-none transition focus:border-white/30 focus:bg-[#1e2333]"
            name="email"
            placeholder="Enter your email"
            required
            type="email"
          />
        </div>

        {/* Password Field */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground-muted/60" size={17} />
          <input
            autoComplete={tab === "signup" ? "new-password" : "current-password"}
            className="min-h-12 w-full rounded-2xl border border-white/10 bg-[#1e2333]/60 pl-11 pr-4 text-sm text-white placeholder-foreground-muted/50 outline-none transition focus:border-white/30 focus:bg-[#1e2333]"
            name="password"
            placeholder={tab === "signup" ? "Create a password" : "Enter your password"}
            required
            type="password"
          />
        </div>

        {/* Primary Action Button */}
        <button
          className="mt-2 min-h-12 w-full rounded-2xl bg-[#eef0f5] text-sm font-semibold text-black shadow-md transition duration-200 hover:bg-white disabled:opacity-50 active:scale-[0.99]"
          disabled={pending !== null}
          type="submit"
        >
          {pending === "form"
            ? "Processing..."
            : tab === "signup"
            ? "Create an account"
            : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted/70">
          OR SIGN IN WITH
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Social sign-in. Google is the only configured provider, so it is the
          only one offered: a button for a provider that is not wired would
          either fail or quietly sign the visitor in with something else. */}
      <div className="grid gap-3">
        <button
          className="flex min-h-12 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#1e2333]/60 text-sm font-semibold text-white transition hover:bg-[#252b3d] disabled:opacity-50"
          disabled={pending !== null}
          onClick={handleGoogleSignIn}
          type="button"
        >
          <GoogleLogo />
          Continue with Google
        </button>
      </div>

      {/* Footer Terms */}
      <p className="mt-6 text-center text-xs text-foreground-muted/70">
        By creating an account, you agree to our{" "}
        <a className="text-foreground-secondary underline transition hover:text-white" href="/terms">
          Terms & Service
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

export function AuthModal({ isOpen, onClose, defaultTab = "signup", returnTo = "/" }: AuthModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Locks background scroll, closes on Escape, and keeps keyboard focus inside
  // the dialog. Without the trap, tabbing walks out into the page behind the
  // overlay, which a keyboard or screen-reader user cannot see is still there.
  useEffect(() => {
    if (!isOpen) return;

    const originalStyle = document.body.style.overflow;
    document.body.style.overflow = "hidden";

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
      document.body.style.overflow = originalStyle;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      aria-label="Sign in or create an account"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      {/* Dimmed backdrop overlay. Decorative: the close button is the labelled control. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-black/92 backdrop-blur-2xl transition-all duration-300"
        onClick={onClose}
      />

      <GlassAuthCard
        defaultTab={defaultTab}
        returnTo={returnTo}
        onClose={onClose}
        showCloseButton={true}
      />
    </div>
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

