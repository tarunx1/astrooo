import { Card } from "@/components/ui/card";

export function EmptyState({
  action,
  icon,
  message,
  title,
}: {
  action?: React.ReactNode;
  icon?: React.ReactNode;
  message?: string;
  title: string;
}) {
  return (
    <Card className="mx-auto max-w-xl p-6 text-center sm:p-7">
      {icon ? (
        <div className="mx-auto mb-4 grid size-11 place-items-center rounded-lg border border-border bg-surface-raised text-premium">
          {icon}
        </div>
      ) : null}
      <h2 className="heading-md">{title}</h2>
      {message ? <p className="mx-auto mt-2 max-w-md body-sm text-foreground-secondary">{message}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </Card>
  );
}
