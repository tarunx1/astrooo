import { cn } from "@/lib/utils";

export function PriceDisplay({
  amount,
  compareAt,
  discountLabel,
  meta,
  size = "md",
}: {
  amount: string;
  compareAt?: string | null;
  discountLabel?: string | null;
  meta?: string;
  size?: "sm" | "md" | "lg";
}) {
  const priceClass = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className="grid gap-1">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cn("font-semibold text-foreground", priceClass)}>{amount}</span>
        {compareAt ? <span className="body-sm text-foreground-muted line-through">{compareAt}</span> : null}
        {discountLabel ? <span className="caption text-success">{discountLabel}</span> : null}
      </p>
      {meta ? <p className="caption text-foreground-muted">{meta}</p> : null}
    </div>
  );
}
