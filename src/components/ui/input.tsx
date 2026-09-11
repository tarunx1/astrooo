import { SmoothInput } from "@/components/ui/smooth-input";
import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <SmoothInput
      className={cn(
        "form-control",
        className,
      )}
      {...props}
    />
  );
}
