import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  variant?: "default" | "interactive" | "premium" | "commerce" | "astrology";
  className?: string;
};

const variants = {
  default: "border-border bg-surface",
  interactive: "border-border bg-surface transition hover:border-primary hover:bg-surface-hover",
  premium: "border-premium/50 bg-surface shadow-[var(--shadow-md)]",
  commerce: "border-border-strong bg-surface-raised",
  astrology: "border-border bg-background-subtle shadow-[var(--shadow-sm)]",
};

export function Card({ children, variant = "default", className }: CardProps) {
  return <div className={cn("rounded-lg border", variants[variant], className)}>{children}</div>;
}
