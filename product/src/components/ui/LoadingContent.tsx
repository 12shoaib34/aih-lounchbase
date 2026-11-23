import type { ReactNode } from "react";
import { DataTable } from "./DataTable";
import { Pagination } from "./Pagination";

export function LoadingValue() {
  return <span className="invoice-loading-value" aria-hidden="true" />;
}

/** Only public layout primitives belong here; feature modules supply composition. */
export function LoadingContent({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="loading-content" aria-busy="true">
      <span role="status" className="sr-only">
        {label}
      </span>
      <div inert aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

export function LoadingPagination() {
  return (
    <Pagination
      label="Loading pages"
      page={1}
      pageSize={20}
      total={0}
      loading
    />
  );
}

export function LoadingTable({
  label,
  columns,
  pagination = false,
  count = false,
}: {
  label: string;
  columns: string[];
  pagination?: boolean;
  count?: boolean;
}) {
  return (
    <LoadingContent label={label}>
      {count && (
        <p className="list-result-summary">
          <LoadingValue />
        </p>
      )}
      <DataTable
        caption={label}
        loading
        rows={[]}
        rowKey={() => ""}
        empty=""
        columns={columns.map((label) => ({
          key: label,
          label,
          render: () => null,
        }))}
      />
      {pagination && <LoadingPagination />}
    </LoadingContent>
  );
}
