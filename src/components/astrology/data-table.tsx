import type { ReactNode } from "react";

export type AstrologyTableColumn<Row> = {
  id: string;
  label: string;
  cell: (row: Row) => ReactNode;
  rowHeader?: boolean;
  headerClassName?: string;
  cellClassName?: string;
};

export function AstrologyDataTable<Row>({
  rows,
  columns,
  rowKey,
  variant = "default",
  emptyMessage = "No data is available.",
}: {
  rows: readonly Row[];
  columns: readonly AstrologyTableColumn<Row>[];
  rowKey: (row: Row) => string;
  variant?: "default" | "gold-header";
  emptyMessage?: string;
}) {
  const headerClass = variant === "gold-header" ? "bg-premium/90 text-background" : "bg-background-subtle/90 text-foreground-muted";

  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-border bg-background/30">
      <table className="w-full min-w-[42rem] border-collapse text-left body-sm">
        <thead className={headerClass}>
          <tr>
            {columns.map((column) => (
              <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] ${column.headerClassName ?? ""}`} key={column.id} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.length === 0 ? (
            <tr>
              <td className="px-4 py-5 text-foreground-muted" colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="transition-colors hover:bg-surface-raised/70" key={rowKey(row)}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th className={`px-4 py-3.5 text-left ${column.cellClassName ?? ""}`} key={column.id} scope="row">
                      {column.cell(row)}
                    </th>
                  ) : (
                    <td className={`px-4 py-3.5 ${column.cellClassName ?? ""}`} key={column.id}>{column.cell(row)}</td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
