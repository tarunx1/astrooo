"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

/**
 * Provider-neutral sign-in panel.
 *
 * Google is currently the only production method, but the layout treats it as
 * one option among several rather than as the sign-in experience itself, so
 * email magic-link / OTP and phone OTP can be added later without a redesign.
 */
type SignInPanelProps = {
  returnTo: string;
  googleEnabled: boolean;
  devCredentialsEnabled: boolean;
};

export function SignInPanel({ returnTo, googleEnabled, devCredentialsEnabled }: SignInPanelProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setPending("google");
    try {
      // callbackURL is a server-validated internal path; never a raw user URL.
      const result = await authClient.signIn.social({ provider: "google", callbackURL: returnTo });
      if (result?.error) {
        setError("Google sign-in did not complete. Please try again.");
        setPending(null);
      }
    } catch {
      setError("Google sign-in is unavailable right now. Please try again.");
      setPending(null);
    }
  }

  async function signInWithDevCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("credentials");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    try {
      const result = await authClient.signIn.email({ email, password });
      if (result?.error) {
        setError(result.error.message ?? "Those credentials were not accepted.");
        setPending(null);
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch {
      setError("Sign-in failed. Please try again.");
      setPending(null);
    }
  }

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-md border border-danger/50 bg-background p-4 body-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {googleEnabled ? (
        <button
          className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md border border-border-strong bg-surface px-5 py-3 text-sm font-semibold transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          disabled={pending !== null}
          onClick={signInWithGoogle}
          type="button"
        >
          <GoogleMark />
          {pending === "google" ? "Opening Google..." : "Continue with Google"}
        </button>
      ) : (
        <p className="rounded-md border border-border bg-surface p-4 body-sm text-foreground-secondary" role="status">
          Google sign-in is not configured on this environment. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable
          it.
        </p>
      )}

      <ul className="grid gap-2">
        <li className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <span className="body-sm text-foreground-muted">Email magic link</span>
          <span className="caption uppercase tracking-wider text-foreground-muted/70">Soon</span>
        </li>
        <li className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
          <span className="body-sm text-foreground-muted">Phone OTP</span>
          <span className="caption uppercase tracking-wider text-foreground-muted/70">Soon</span>
        </li>
      </ul>

      {devCredentialsEnabled ? (
        <form className="grid gap-3 border-t border-border pt-5" onSubmit={signInWithDevCredentials}>
          <p className="caption text-foreground-muted">Development credentials (not available in production)</p>
          <label className="grid gap-1.5 caption text-foreground-secondary" htmlFor="dev-email">
            Email
            <input
              autoComplete="email"
              className="min-h-11 rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
              id="dev-email"
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-1.5 caption text-foreground-secondary" htmlFor="dev-password">
            Password
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-md border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
              id="dev-password"
              name="password"
              required
              type="password"
            />
          </label>
          <button
            className="min-h-11 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            disabled={pending !== null}
            type="submit"
          >
            {pending === "credentials" ? "Signing in..." : "Sign in"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function GoogleMark() {
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
