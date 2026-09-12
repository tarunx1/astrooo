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
  padding?: "none" | "sm" | "md" | "lg";
  equalHeight?: boolean;
  spotlight?: boolean;
  className?: string;
};

const variants = {
  default: "border-border bg-card text-card-foreground shadow-[var(--shadow-sm)]",
  interactive:
    "border-border bg-card text-card-foreground shadow-[var(--shadow-sm)] transition hover:border-primary hover:bg-surface-hover hover:shadow-[var(--shadow-md)]",
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

const paddingStyles = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-5 sm:p-6",
};

export function Card({
  children,
  variant = "default",
  padding = "none",
  equalHeight = false,
  spotlight = false,
  className,
  ...props
}: CardProps) {
  const classes = cn(
    "rounded-lg border",
    variants[variant],
    paddingStyles[padding],
    equalHeight && "flex h-full flex-col",
    className,
  );

  if (variant.startsWith("glass") || spotlight) {
    const glassVariant = (variant.startsWith("glass") ? variant : "glass") as
      | "glass"
      | "glass-raised"
      | "glass-premium"
      | "glass-subtle";
    return (
      <GlassCard variant={glassVariant} spotlight={spotlight} className={classes} {...props}>
        {children}
      </GlassCard>
    );
  }
  return (
    <div className={classes} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-1 flex-col", className)}>{children}</div>;
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mt-auto pt-4", className)}>{children}</div>;
}

export { GlassCard };
