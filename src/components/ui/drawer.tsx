import { cn } from "@/lib/utils";

type DrawerProps = {
  open?: boolean;
  title: string;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
};

export function Drawer({ open = false, title, children, side = "right", className }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" role="presentation">
      <aside
        aria-label={title}
        className={cn(
          "fixed top-0 h-full w-full max-w-sm border-border bg-surface p-6 shadow-[var(--shadow-lg)]",
          side === "right" ? "right-0 border-l" : "left-0 border-r",
          className,
        )}
      >
        <h2 className="heading-lg">{title}</h2>
        <div className="mt-4">{children}</div>
      </aside>
    </div>
  );
}
