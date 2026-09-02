import { cn } from "@/lib/utils";

export function RadioGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-3", className)}>{children}</div>;
}

type RadioOptionProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
};

export function RadioOption({ className, label, ...props }: RadioOptionProps) {
  return (
    <label className="flex items-center gap-3 body-sm text-foreground-secondary">
      <input className={cn("size-4 border-border-strong accent-primary", className)} type="radio" {...props} />
      {label}
    </label>
  );
}
