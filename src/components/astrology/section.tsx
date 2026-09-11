import { cn } from "@/lib/utils";

export function AstrologySection({
  children,
  title,
  description,
  className,
  headingLevel = "h2",
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;

  return (
    <section className={cn("astro-card min-w-0 p-5 sm:p-6", className)}>
      {title ? <Heading className="heading-lg">{title}</Heading> : null}
      {description ? <p className="mt-2 max-w-3xl body-sm text-foreground-secondary">{description}</p> : null}
      <div className={title || description ? "mt-5" : undefined}>{children}</div>
    </section>
  );
}
