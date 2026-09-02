import { cn } from "@/lib/utils";

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "min-h-11 w-full rounded-md border border-border-strong bg-background px-3 body-sm text-foreground outline-none transition focus:border-accent-cyan",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
