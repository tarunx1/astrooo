import { AccountDashboardShell } from "@/components/account/account-sidebar-client";

export function AccountHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? <p className="mb-3 caption uppercase text-premium">{eyebrow}</p> : null}
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
  eyebrow,
  children,
}: {
  currentPath: string;
  title: string;
  description?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-[calc(100vh-var(--header-height))] bg-background">
      <AccountDashboardShell currentPath={currentPath}>
        <div className="min-w-0">
          <AccountHeader description={description} eyebrow={eyebrow} title={title} />
          <div className="grid gap-8">{children}</div>
        </div>
      </AccountDashboardShell>
    </section>
  );
}
