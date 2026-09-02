import Link from "next/link";
import { PageContainer, Section } from "@/components/layout/primitives";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { accountNavigation } from "@/config/account-navigation";

/**
 * Account shell.
 *
 * Desktop renders a sidebar beside the content; mobile renders a compact
 * horizontally scrollable rail above it. Everything is expressed in existing
 * design tokens so the account area inherits any future token change.
 */
function NavLabel({ item, active }: { item: (typeof accountNavigation)[number]; active: boolean }) {
  const Icon = item.icon;
  return (
    <>
      <Icon aria-hidden="true" className={cn("shrink-0", active ? "text-primary" : "text-foreground-muted")} size={18} />
      <span className="truncate">{item.label}</span>
    </>
  );
}

export function AccountSidebar({ currentPath }: { currentPath: string }) {
  return (
    <nav aria-label="Account navigation" className="hidden lg:block">
      <Card className="p-2">
        <ul className="grid gap-1">
          {accountNavigation.map((item) => {
            const active = currentPath === item.href;
            const planned = item.status === "planned";

            return (
              <li key={item.href}>
                {planned ? (
                  <span
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground-muted/60"
                    title="Coming in a later release"
                  >
                    <NavLabel active={false} item={item} />
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-foreground-muted/70">Soon</span>
                  </span>
                ) : (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                      active
                        ? "bg-surface-raised text-foreground"
                        : "text-foreground-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                    href={item.href}
                    prefetch={false}
                  >
                    <NavLabel active={active} item={item} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </nav>
  );
}

export function AccountMobileNav({ currentPath }: { currentPath: string }) {
  const items = accountNavigation.filter((item) => item.status === "available");

  return (
    <nav aria-label="Account navigation" className="lg:hidden">
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = currentPath === item.href;
          return (
            <li key={item.href}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md border px-3.5 py-2 text-sm font-medium transition",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                  active
                    ? "border-primary bg-surface-raised text-foreground"
                    : "border-border bg-surface text-foreground-muted",
                )}
                href={item.href}
                prefetch={false}
              >
                <NavLabel active={active} item={item} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AccountHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h1 className="heading-xl">{title}</h1>
      {description ? <p className="mt-3 body-md text-foreground-secondary">{description}</p> : null}
    </div>
  );
}

export function AccountSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="heading-md">{title}</h2>
          {description ? <p className="mt-1.5 body-sm text-foreground-secondary">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function AccountLayout({
  currentPath,
  title,
  description,
  children,
}: {
  currentPath: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Section className="star-field">
      <PageContainer className="px-0">
        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-10">
          <div className="grid gap-4 lg:gap-0">
            <AccountSidebar currentPath={currentPath} />
            <AccountMobileNav currentPath={currentPath} />
          </div>
          <div className="min-w-0">
            <AccountHeader description={description} title={title} />
            <div className="grid gap-8">{children}</div>
          </div>
        </div>
      </PageContainer>
    </Section>
  );
}
