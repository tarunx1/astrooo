import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  variant?:
    | "default"
    | "interactive"
    | "premium"
    | "commerce"
    | "astrology"
    | "admin"
    | "admin-interactive"
    | "glass"
    | "glass-raised"
    | "glass-premium"
    | "glass-subtle";
  spotlight?: boolean;
  className?: string;
};

const variants = {
  default: "border-border bg-card text-card-foreground",
  interactive: "border-border bg-card text-card-foreground transition hover:border-primary hover:bg-surface-hover",
  premium: "border-premium/50 bg-card text-card-foreground shadow-[var(--shadow-md)]",
  commerce: "border-border-strong bg-surface-raised",
  astrology: "border-border bg-background-subtle shadow-[var(--shadow-sm)]",
  admin: "border-border bg-card text-card-foreground shadow-xs",
  "admin-interactive": "border-border bg-card text-card-foreground shadow-xs transition hover:border-primary hover:shadow-sm",
  glass: "border-border bg-card/75 backdrop-blur-xl shadow-[var(--shadow-md)]",
  "glass-raised": "border-border-strong bg-surface-raised/80 backdrop-blur-2xl shadow-[var(--shadow-lg)]",
  "glass-premium": "border-premium/40 bg-surface/80 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(214,181,109,0.15)]",
  // The lightest of the four, for a panel nested inside another glass card -
  // stacking two full-strength blurs reads as muddy rather than layered.
  "glass-subtle": "border-border bg-surface/50 backdrop-blur-md",
};

export function Card({ children, variant = "default", spotlight = false, className, ...props }: CardProps) {
  if (variant.startsWith("glass") || spotlight) {
    const glassVariant = (variant.startsWith("glass") ? variant : "glass") as
      | "glass"
      | "glass-raised"
      | "glass-premium"
      | "glass-subtle";
    return (
      <GlassCard variant={glassVariant} spotlight={spotlight} className={className} {...props}>
        {children}
      </GlassCard>
    );
  }
  return (
    <div className={cn("rounded-lg border", variants[variant], className)} {...props}>
      {children}
    </div>
  );
}

export { GlassCard };
