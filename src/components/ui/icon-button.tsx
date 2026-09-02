import Link from "next/link";
import { cn } from "@/lib/utils";

type IconButtonProps = {
  label: string;
  children: React.ReactNode;
  href?: string;
  className?: string;
  type?: "button" | "submit";
};

export function IconButton({ label, children, href, className, type = "button" }: IconButtonProps) {
  const classes = cn(
    "grid size-10 place-items-center rounded-md border border-border bg-surface text-foreground-secondary transition hover:border-primary hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-cyan",
    className,
  );

  if (href) {
    return (
      <Link aria-label={label} className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button aria-label={label} className={classes} type={type}>
      {children}
    </button>
  );
}
