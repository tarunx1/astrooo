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
    <div className={cn("form-field grid min-w-0 gap-2", className)} data-invalid={error ? "true" : undefined}>
      <Label htmlFor={id}>{label}</Label>
      {Children.map(children, (child) => {
        if (!isValidElement<HTMLAttributes<HTMLElement>>(child) || child.props.id !== id) return child;
        const feedbackId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
        return cloneElement(child, {
          "aria-invalid": error ? true : child.props["aria-invalid"],
          "aria-describedby": [child.props["aria-describedby"], feedbackId].filter(Boolean).join(" ") || undefined,
        });
      })}
      {error ? <p className="caption text-danger" id={`${id}-error`} role="alert">{error}</p> : null}
      {!error && hint ? <p className="caption text-foreground-muted" id={`${id}-hint`}>{hint}</p> : null}
    </div>
  );
}
import { Children, cloneElement, isValidElement, type HTMLAttributes } from "react";
