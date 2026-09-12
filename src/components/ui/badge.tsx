import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "premium" | "success" | "warning" | "danger" | "info";
  className?: string;
};

const variants = {
  default: "border-border bg-surface text-foreground-secondary",
  premium: "border-premium/50 bg-premium/10 text-premium",
  success: "border-success/50 bg-success/10 text-success",
  warning: "border-warning/50 bg-warning/10 text-warning",
  danger: "border-danger/50 bg-danger/10 text-danger",
  info: "border-primary/40 bg-primary/10 text-primary",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 py-1 caption", variants[variant], className)}>
      {children}
    </span>
  );
}
