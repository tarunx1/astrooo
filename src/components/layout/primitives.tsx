import { cn } from "@/lib/utils";

export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-[var(--container-xl)] px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section className={cn("py-[var(--section-space-md)]", className)} id={id}>
      <PageContainer>{children}</PageContainer>
    </section>
  );
}

export function SectionHeader({
  title,
  text,
  action,
  className,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-[var(--container-sm)]">
        <h2 className="heading-xl">{title}</h2>
        {text ? <p className="mt-4 body-lg text-foreground-secondary">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ResponsiveGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}

export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4", className)}>{children}</div>;
}

export function Inline({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>;
}

export function ContentGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-8 lg:grid-cols-[0.8fr_1.2fr]", className)}>{children}</div>;
}

export function ProseContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("max-w-[var(--container-sm)] text-foreground-secondary", className)}>{children}</div>;
}
