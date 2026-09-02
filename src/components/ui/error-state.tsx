import { Card } from "@/components/ui/card";

export function ErrorState({ title = "Something went wrong", message }: { title?: string; message?: string }) {
  return (
    <Card className="border-danger/50 p-6">
      <h2 className="heading-md text-danger">{title}</h2>
      {message ? <p className="mt-2 body-sm text-foreground-secondary">{message}</p> : null}
    </Card>
  );
}
