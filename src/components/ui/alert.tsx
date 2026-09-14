import { cn } from "@/lib/utils";

/**
 * A notice that carries meaning by tone.
 *
 * Admin screens had grown a habit of writing these inline as
 * `border-slate-200 bg-slate-50`, which is a light surface no matter what the
 * theme says - so every one of them turned into a white rectangle on a dark
 * page. Tone lives here instead, expressed in semantic tokens, so a notice is
 * correct in both themes wherever it is used.
 *
 * Tints are mixed from the tone's own token rather than set to a fixed colour.
 * `--warning` is a deep amber in light mode and a soft one in dark, so the same
 * `bg-warning/10` reads as a pale amber card on white and a dim amber-tinted
 * panel on navy, with no `dark:` variant written anywhere.
 */
const tones = {
  info: "border-border bg-surface-muted text-foreground-secondary",
  warning: "border-warning/45 bg-warning/10 text-foreground-secondary",
  success: "border-success/45 bg-success/10 text-foreground-secondary",
  danger: "border-danger/50 bg-danger/10 text-foreground-secondary",
};

const titleTones = {
  info: "text-foreground",
  warning: "text-warning",
  success: "text-success",
  danger: "text-danger",
};

export type AlertVariant = keyof typeof tones;

export function Alert({
  variant = "info",
  title,
  children,
  className,
  role,
}: {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  return (
    <div className={cn("rounded-lg border p-4", tones[variant], className)} role={role}>
      {title ? <p className={cn("mb-1 text-sm font-semibold", titleTones[variant])}>{title}</p> : null}
      <div className="caption text-inherit">{children}</div>
    </div>
  );
}
