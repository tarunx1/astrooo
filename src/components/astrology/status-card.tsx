import { cn } from "@/lib/utils";

export function AstrologyStatusCard({
  title,
  status,
  children,
  tone = "premium",
}: {
  title: string;
  status: string;
  children: React.ReactNode;
  tone?: "premium" | "warning" | "success";
}) {
  const tones = { premium: "text-premium", warning: "text-warning", success: "text-success" };
  return (
    <section className="astro-card min-w-0 p-5 sm:p-6">
      <h2 className="heading-lg">{title}</h2>
      <p className={cn("mt-4 heading-md", tones[tone])}>{status}</p>
      <div className="mt-2 body text-foreground-secondary">{children}</div>
    </section>
  );
}
