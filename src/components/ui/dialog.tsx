import { cn } from "@/lib/utils";

type DialogProps = {
  open?: boolean;
  title: string;
  children: React.ReactNode;
  className?: string;
};

export function Dialog({ open = false, title, children, className }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-5 backdrop-blur-sm" role="presentation">
      <section
        aria-modal="true"
        className={cn("w-full max-w-[var(--container-sm)] rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-lg)]", className)}
        role="dialog"
      >
        <h2 className="heading-lg">{title}</h2>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}
