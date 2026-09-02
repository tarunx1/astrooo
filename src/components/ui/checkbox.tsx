import { cn } from "@/lib/utils";

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <input
      className={cn("size-4 rounded-sm border-border-strong accent-primary", className)}
      type="checkbox"
      {...props}
    />
  );
}
