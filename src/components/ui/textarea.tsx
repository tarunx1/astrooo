import { cn } from "@/lib/utils";

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-border-strong bg-background px-3 py-3 body-sm text-foreground outline-none transition placeholder:text-foreground-muted focus:border-accent-cyan",
        className,
      )}
      {...props}
    />
  );
}
