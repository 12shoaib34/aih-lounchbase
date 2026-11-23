import type { ReactNode } from "react";
export function DataTable<T>({
  caption,
  rows,
  columns,
  rowKey,
  empty,
  loading = false,
}: {
  caption: string;
  rows: readonly T[];
  columns: readonly {
    key: string;
    label: string;
    render: (row: T) => ReactNode;
  }[];
  rowKey: (row: T) => string;
  empty: string;
  loading?: boolean;
}) {
  if (!loading && !rows.length) return <p className="portal-empty">{empty}</p>;
  return (
    <div
      className="table-scroll"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th scope="col" key={column.key}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr aria-hidden="true">
              {columns.map((column, index) =>
                index === 0 ? (
                  <th scope="row" key={column.key}>
                    <span className="table-skeleton" />
                  </th>
                ) : (
                  <td key={column.key} data-label={column.label}>
                    <span className="table-skeleton" />
                  </td>
                ),
              )}
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column, index) =>
                  index === 0 ? (
                    <th scope="row" key={column.key}>
                      {column.render(row)}
                    </th>
                  ) : (
                    <td key={column.key} data-label={column.label}>
                      {column.render(row)}
                    </td>
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
