import { cn } from "@/lib/utils";

type BadgeProps = {
  children: React.ReactNode;
  variant?: "default" | "premium" | "success" | "warning" | "danger";
  className?: string;
};

const variants = {
  default: "border-border bg-surface text-foreground-secondary",
  premium: "border-premium/50 bg-premium/10 text-premium",
  success: "border-success/50 bg-success/10 text-success",
  warning: "border-warning/50 bg-warning/10 text-warning",
  danger: "border-danger/50 bg-danger/10 text-danger",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-sm border px-2.5 py-1 caption", variants[variant], className)}>
      {children}
    </span>
  );
}
