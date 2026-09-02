import { Card } from "@/components/ui/card";

export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <Card className="p-6 text-center">
      <h2 className="heading-md">{title}</h2>
      {message ? <p className="mt-2 body-sm text-foreground-secondary">{message}</p> : null}
    </Card>
  );
}
