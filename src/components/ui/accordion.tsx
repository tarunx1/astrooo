import { cn } from "@/lib/utils";

type AccordionItem = {
  title: string;
  content: React.ReactNode;
};

export function Accordion({ items, className }: { items: AccordionItem[]; className?: string }) {
  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border bg-surface", className)}>
      {items.map((item) => (
        <details className="group p-4" key={item.title}>
          <summary className="cursor-pointer heading-sm text-foreground marker:text-premium">{item.title}</summary>
          <div className="mt-3 body-sm text-foreground-secondary">{item.content}</div>
        </details>
      ))}
    </div>
  );
}
