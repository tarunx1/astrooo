import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui/glass-card";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  variant?: "default" | "interactive" | "premium" | "commerce" | "astrology" | "glass" | "glass-raised" | "glass-premium";
  spotlight?: boolean;
  className?: string;
};

const variants = {
  default: "border-border bg-surface",
  interactive: "border-border bg-surface transition hover:border-primary hover:bg-surface-hover",
  premium: "border-premium/50 bg-surface shadow-[var(--shadow-md)]",
  commerce: "border-border-strong bg-surface-raised",
  astrology: "border-border bg-background-subtle shadow-[var(--shadow-sm)]",
  glass: "border-white/10 bg-surface/75 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]",
  "glass-raised": "border-white/15 bg-surface-raised/80 backdrop-blur-2xl shadow-[0_12px_40px_0_rgba(0,0,0,0.45)]",
  "glass-premium": "border-premium/40 bg-surface/80 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(214,181,109,0.15)]",
};

export function Card({ children, variant = "default", spotlight = false, className, ...props }: CardProps) {
  if (variant.startsWith("glass") || spotlight) {
    const glassVariant = (variant.startsWith("glass") ? variant : "glass") as "glass" | "glass-raised" | "glass-premium";
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

