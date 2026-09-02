import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "min-h-11 w-full rounded-md border border-border-strong bg-background px-3 body-sm text-foreground outline-none transition placeholder:text-foreground-muted focus:border-accent-cyan",
        className,
      )}
      {...props}
    />
  );
}
