import Link from "next/link";
import { Menu, ShoppingBag, X } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { brand } from "@/config/brand";
import { navigation } from "@/config/navigation";
import { AccountMenu } from "@/components/account/account-menu";
import { HeaderKundliButton } from "@/components/navigation/header-kundli-button";
import { getAdminIdentity } from "@/lib/auth/admin";
import { SUPER_ADMIN_DASHBOARD_PATH } from "@/lib/auth/post-login";
import { getCurrentUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const primaryNav = navigation.filter((item) => !("utilityOnly" in item));
  const user = await getCurrentUser();
  const admin = user ? await getAdminIdentity() : null;
  const accountHref = admin?.isSuperAdmin ? SUPER_ADMIN_DASHBOARD_PATH : "/account";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <PageContainer className="flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link aria-label={brand.name} className="flex items-center gap-3" href="/" prefetch={false}>
          <span className="grid size-11 place-items-center rounded-full border border-premium/70 bg-surface text-caption text-premium">
            {brand.logo.mark}
          </span>
          <span className="font-display text-2xl leading-none">{brand.logo.label}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-0.5 lg:flex">
          {primaryNav.map((item) => (
            <div className="group relative" key={item.label}>
              {"planned" in item && item.planned ? (
                <span
                  aria-disabled="true"
                  className="block cursor-not-allowed rounded-md px-3 py-2 text-sm font-medium text-foreground-muted opacity-60"
                  title="Coming soon"
                >
                  {item.label}
                </span>
              ) : (
                <Link className="rounded-md px-2.5 py-2 text-sm font-medium text-foreground-muted transition hover:text-foreground" href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              )}
              {item.items.length ? (
                <div className="invisible absolute left-0 top-10 w-[620px] translate-y-2 rounded-xl border border-border bg-popover/90 p-5 text-popover-foreground opacity-0 shadow-[var(--shadow-lg)] backdrop-blur-2xl transition duration-300 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="grid grid-cols-2 gap-3">
                    {item.items.map((child) =>
                      "planned" in child && child.planned ? (
                        <span
                          aria-disabled="true"
                          className="cursor-not-allowed rounded-lg p-3 opacity-60"
                          key={child.label}
                          title="Coming soon"
                        >
                          <span className="block text-sm font-semibold text-foreground-muted">
                            {child.label}
                            <span className="ml-2 text-[10px] uppercase tracking-wider text-premium">Soon</span>
                          </span>
                          <span className="mt-1 block body-sm text-foreground-muted">{child.description}</span>
                        </span>
                      ) : (
                        <Link
                          className="group/item rounded-lg border border-transparent p-3 transition-all duration-200 hover:border-border hover:bg-surface-hover hover:shadow-lg"
                          href={child.href}
                          key={child.label}
                          prefetch={false}
                        >
                          <span className="block text-sm font-semibold text-foreground group-hover/item:text-premium transition-colors">
                            {child.label}
                          </span>
                          <span className="mt-1 block body-sm text-foreground-muted">{child.description}</span>
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <AccountMenu
            user={
              user
                ? {
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    dashboardHref: accountHref,
                    dashboardLabel: admin?.isSuperAdmin ? "Super Admin Dashboard" : "My Account",
                  }
                : null
            }
          />
          <Link aria-label="Cart" className="grid size-10 place-items-center rounded-md text-foreground-muted transition hover:bg-surface hover:text-foreground" href="/cart" prefetch={false}>
            <ShoppingBag size={17} strokeWidth={1.9} />
          </Link>
          <HeaderKundliButton />
        </div>

        <details className="group lg:hidden">
          <summary
            aria-label="Toggle navigation"
            className="grid size-11 cursor-pointer list-none place-items-center rounded-md border border-border text-foreground [&::-webkit-details-marker]:hidden"
          >
            <Menu className="group-open:hidden" size={19} strokeWidth={1.9} />
            <X className="hidden group-open:block" size={19} strokeWidth={1.9} />
          </summary>
          <div className="fixed left-0 right-0 top-[var(--header-height)] border-t border-border bg-background shadow-[var(--shadow-md)]">
            <PageContainer className="grid gap-2 py-5">
              {primaryNav.map((item) =>
                "planned" in item && item.planned ? (
                  <span
                    aria-disabled="true"
                    className="rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground-muted opacity-60"
                    key={item.label}
                  >
                    {item.label}
                    <span className="ml-2 text-[10px] uppercase tracking-wider text-premium">Soon</span>
                  </span>
                ) : (
                  <Link className="rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold" href={item.href} key={item.label} prefetch={false}>
                    {item.label}
                  </Link>
                ),
              )}
              <div className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3">
                <span className="text-sm font-semibold text-foreground-secondary">Theme</span>
                <ThemeToggle />
              </div>
              <Link
                className="rounded-md border border-primary bg-surface-raised px-4 py-3 text-sm font-semibold"
                href={user ? accountHref : "/sign-in"}
                prefetch={false}
              >
                {user ? (admin?.isSuperAdmin ? "Super Admin" : "My Account") : "Sign In"}
              </Link>
            </PageContainer>
          </div>
        </details>
      </PageContainer>
    </header>
  );
}
