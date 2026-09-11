import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layout/primitives";

/** Shared dark, star-backed frame for private astrology results and reports. */
export function AstrologyPageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className="star-field py-[var(--section-space-md)]">
      <PageContainer className={cn("grid min-w-0 gap-6 px-4 sm:px-6 lg:px-8", className)}>{children}</PageContainer>
    </section>
  );
}
