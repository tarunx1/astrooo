import Link from "next/link";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { PageContainer } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { navigation } from "@/config/navigation";
import { AccountMenu } from "@/components/account/account-menu";
import { getCurrentUser } from "@/lib/auth/session";

export async function SiteHeader() {
  const primaryNav = navigation.filter((item) => !("utilityOnly" in item));
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <PageContainer className="flex h-[var(--header-height)] items-center justify-between gap-6">
        <Link aria-label={brand.name} className="flex items-center gap-3" href="/" prefetch={false}>
          <span className="grid size-11 place-items-center rounded-full border border-premium/70 bg-surface text-caption text-premium">
            {brand.logo.mark}
          </span>
          <span className="font-display text-2xl leading-none">{brand.logo.label}</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {primaryNav.map((item) => (
            <div className="group relative" key={item.label}>
              <Link className="rounded-md px-3 py-2 text-sm font-medium text-foreground-muted transition hover:text-foreground" href={item.href} prefetch={false}>
                {item.label}
              </Link>
              {item.items.length ? (
                <div className="invisible absolute left-0 top-10 w-[620px] translate-y-2 border border-border bg-surface/95 p-5 opacity-0 shadow-[var(--shadow-md)] backdrop-blur-xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="grid grid-cols-2 gap-3">
                    {item.items.map((child) => (
                      <Link className="rounded-md p-3 transition hover:bg-surface-raised" href={child.href} key={child.label} prefetch={false}>
                        <span className="block text-sm font-semibold text-foreground">{child.label}</span>
                        <span className="mt-1 block body-sm text-foreground-muted">{child.description}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link aria-label="Search" className="grid size-10 place-items-center rounded-md text-foreground-muted transition hover:bg-surface hover:text-foreground" href="/search" prefetch={false}>
            <Search size={18} />
          </Link>
          <AccountMenu user={user ? { name: user.name, email: user.email, image: user.image } : null} />
          <Link aria-label="Cart" className="grid size-10 place-items-center rounded-md text-foreground-muted transition hover:bg-surface hover:text-foreground" href="/cart" prefetch={false}>
            <ShoppingBag size={18} />
          </Link>
          <Button href="/kundli" className="min-h-10 px-4 py-2" variant="secondary">
            Generate Kundli
          </Button>
        </div>

        <details className="group lg:hidden">
          <summary
            aria-label="Toggle navigation"
            className="grid size-11 cursor-pointer list-none place-items-center rounded-md border border-border text-foreground [&::-webkit-details-marker]:hidden"
          >
            <Menu className="group-open:hidden" size={20} />
            <X className="hidden group-open:block" size={20} />
          </summary>
          <div className="fixed left-0 right-0 top-[var(--header-height)] border-t border-border bg-background shadow-[var(--shadow-md)]">
            <PageContainer className="grid gap-2 py-5">
              {primaryNav.map((item) => (
                <Link className="rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold" href={item.href} key={item.label} prefetch={false}>
                  {item.label}
                </Link>
              ))}
              <Link
                className="rounded-md border border-primary bg-surface-raised px-4 py-3 text-sm font-semibold"
                href={user ? "/account" : "/sign-in"}
                prefetch={false}
              >
                {user ? "My Account" : "Sign In"}
              </Link>
            </PageContainer>
          </div>
        </details>
      </PageContainer>
    </header>
  );
}
