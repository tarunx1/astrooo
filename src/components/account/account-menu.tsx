"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { availableAccountNavigation } from "@/config/account-navigation";

export type AccountMenuUser = {
  name: string;
  email: string;
  image: string | null;
};

/**
 * Header account control.
 *
 * Anonymous visitors get a plain Sign In link. Authenticated visitors get a
 * menu button with aria-expanded, Escape-to-close, outside-click dismissal and
 * focus return - the same affordance on desktop and mobile.
 */
import { AuthModal } from "@/components/account/auth-modal";

export function AccountMenu({ user }: { user: AccountMenuUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <>
        <button
          className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          onClick={() => setAuthModalOpen(true)}
          type="button"
        >
          <UserRound aria-hidden="true" size={18} />
          Sign In
        </button>
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          defaultTab="signup"
        />
      </>
    );
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  async function handleSignOut() {
    setPending(true);
    try {
      await authClient.signOut();
      setOpen(false);
      router.replace("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        aria-controls={open ? menuId : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="grid size-10 place-items-center rounded-full border border-border text-foreground-muted transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
        onClick={() => setOpen((value) => !value)}
        ref={triggerRef}
        type="button"
      >
        {user.image ? (
          <Image alt="" className="size-10 rounded-full object-cover" height={40} src={user.image} width={40} />
        ) : (
          <span aria-hidden="true" className="text-sm font-semibold text-foreground">
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-12 z-50 w-64 rounded-md border border-border bg-surface p-2 shadow-[var(--shadow-lg)]"
          id={menuId}
          role="menu"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-foreground">{user.name || "My Account"}</p>
            <p className="truncate caption text-foreground-muted">{user.email}</p>
          </div>

          <ul className="grid gap-0.5 py-1">
            {availableAccountNavigation.map((item) => (
              <li key={item.href}>
                <Link
                  className="block rounded-md px-3 py-2 text-sm text-foreground-muted transition hover:bg-surface-hover hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
                  href={item.href}
                  onClick={() => setOpen(false)}
                  prefetch={false}
                  role="menuitem"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="border-t border-border pt-1">
            <button
              className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-danger transition hover:bg-surface-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
              disabled={pending}
              onClick={handleSignOut}
              role="menuitem"
              type="button"
            >
              {pending ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
