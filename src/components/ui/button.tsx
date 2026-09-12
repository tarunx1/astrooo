import Link from "next/link";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: React.ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "text" | "premium" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const variants = {
  primary: "bg-primary text-primary-foreground shadow-[var(--shadow-md)] hover:bg-primary-hover active:bg-primary-active",
  premium: "bg-premium text-background shadow-[var(--shadow-md)] hover:opacity-95",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-hover",
  outline: "border border-border-strong bg-transparent text-foreground hover:border-primary hover:text-primary",
  ghost: "text-foreground-muted hover:text-foreground",
  text: "min-h-0 rounded-none px-0 py-0 text-premium hover:text-foreground hover:underline",
  danger: "bg-danger text-primary-foreground hover:opacity-90",
};

const sizes = {
  sm: "min-h-9 px-3 py-2 text-xs",
  md: "min-h-11 px-5 py-3 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
  xl: "min-h-14 px-7 py-4 text-base",
};

export function Button({
  children,
  href,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  disabled,
  onClick,
}: ButtonProps) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition duration-[var(--motion-fast)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-ring",
    variants[variant],
    variant !== "text" ? sizes[size] : null,
    disabled && !href ? "cursor-not-allowed opacity-60" : null,
    disabled && href ? "pointer-events-none opacity-60" : null,
    className,
  );

  if (href) {
    return (
      <Link className={classes} href={href} prefetch={false}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  );
}
