import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
};

export function FormField({ id, label, children, hint, error, className }: FormFieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="caption text-danger">{error}</p> : null}
      {!error && hint ? <p className="caption text-foreground-muted">{hint}</p> : null}
    </div>
  );
}
