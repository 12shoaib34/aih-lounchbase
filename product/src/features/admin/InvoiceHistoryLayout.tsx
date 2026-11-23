import { Pagination } from "@/components/ui/Pagination";
import { pageDescriptions } from "@/app/pageMetadata";
import type { ReactNode } from "react";
import type { z } from "zod";
import { Link, useLocation, useSearchParams } from "@/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { DataTable } from "@/components/ui/DataTable";
import {
  invoiceListQuery,
  invoiceListSchema,
  formatMoney,
} from "../../../shared/billing";

type Filters = z.infer<typeof invoiceListQuery>;
type InvoicePage = z.infer<typeof invoiceListSchema>;

export function InvoiceHistoryLayout({
  children,
  filters,
  searchValue,
  onSearchValue,
  onFilter,
  canCreate,
  checkingAccess = false,
}: {
  children: ReactNode;
  filters: Filters;
  searchValue: string;
  onSearchValue?: (value: string) => void;
  onFilter?: (changes: Partial<Filters>) => void;
  canCreate?: boolean;
  checkingAccess?: boolean;
}) {
  const location = useLocation();
  return (
    <div className="billing-history">
      <PageHeader
        title="Billing"
        description={pageDescriptions["Billing"]}
        actions={
          checkingAccess ? (
            <span
              className="button billing-action-placeholder"
              aria-hidden="true"
            >
              <span>New invoice</span>
            </span>
          ) : (
            canCreate && (
              <Link
                className="button"
                to={`/admin/billing/new${location.search}`}
              >
                New invoice
              </Link>
            )
          )
        }
      />
      <div className="billing-toolbar">
        <form
          className="directory-search"
          onSubmit={(event) => {
            event.preventDefault();
            onFilter?.({ search: searchValue.trim(), page: 1 });
          }}
        >
          <Field
            label="Search invoices"
            name="search"
            type="search"
            maxLength={100}
            placeholder="Reference, recipient or email"
            value={searchValue}
            disabled={checkingAccess}
            onChange={(event) => onSearchValue?.(event.target.value)}
          />
          <Button variant="secondary" type="submit" disabled={checkingAccess}>
            Search
          </Button>
        </form>
        <SelectField
          label="Status"
          value={filters.status}
          disabled={checkingAccess}
          onChange={(event) =>
            onFilter?.({
              status: event.target.value as Filters["status"],
              page: 1,
            })
          }
        >
          <option value="all">All statuses</option>
          <option value="outstanding">Outstanding</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="paid">Paid</option>
          <option value="void">Void</option>
        </SelectField>
      </div>
      {(filters.search || filters.status !== "all") && (
        <Button
          variant="secondary"
          disabled={checkingAccess}
          onClick={() => onFilter?.({ search: "", status: "all", page: 1 })}
        >
          Clear filters
        </Button>
      )}
      {children}
    </div>
  );
}

export function InvoiceHistoryResults({
  data,
  filters,
  onPage,
  loadingLabel = "Loading invoices…",
}: {
  data?: InvoicePage;
  filters: Filters;
  onPage?: (page: number) => void;
  loadingLabel?: string;
}) {
  const { search } = useLocation();
  const loading = !data;
  return (
    <div className="billing-results" aria-busy={loading}>
      <p className="list-result-summary" role="status">
        {data ? (
          `${data.total} ${data.total === 1 ? "invoice" : "invoices"}`
        ) : (
          <>
            <span className="sr-only">{loadingLabel}</span>
            <span
              className="invoice-skeleton invoice-count-skeleton"
              aria-hidden="true"
            />
          </>
        )}
      </p>
      <DataTable
        caption="Invoices"
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={loading}
        empty={
          filters.search || filters.status !== "all"
            ? "No invoices match these filters."
            : "No invoices yet. Create an invoice to get started."
        }
        columns={[
          {
            key: "reference",
            label: "Invoice",
            render: (row) => (
              <Link to={`/admin/billing/${row.id}${search}`}>
                {row.reference}
              </Link>
            ),
          },
          {
            key: "recipient",
            label: "Bill to",
            render: (row) => row.recipient,
          },
          {
            key: "date",
            label: "Date",
            render: (row) => row.invoiceDate || "—",
          },
          {
            key: "due",
            label: "Due date",
            render: (row) =>
              row.overdue ? `${row.dueDate} · Overdue` : row.dueDate || "—",
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <span className={`billing-status billing-status-${row.status}`}>
                {row.partial ? "Partially paid" : row.status}
              </span>
            ),
          },
          {
            key: "total",
            label: "Total",
            render: (row) => (
              <span className="billing-money">
                {formatMoney(row.total, row.currency)}
              </span>
            ),
          },
          {
            key: "balance",
            label: "Balance",
            render: (row) => (
              <span className="billing-money">
                {formatMoney(row.balance, row.currency)}
              </span>
            ),
          },
        ]}
      />
      <Pagination
        label="Invoice pages"
        page={filters.page}
        pageSize={data?.pageSize ?? 20}
        total={data?.total ?? 0}
        loading={loading}
        onPageChange={onPage}
      />
    </div>
  );
}

/** Public structure only; no data fetches, record values or permission guesses. */
export function InvoiceHistorySkeleton() {
  const [params] = useSearchParams();
  const parsed = invoiceListQuery.safeParse(Object.fromEntries(params));
  const filters = parsed.success ? parsed.data : invoiceListQuery.parse({});
  return (
    <InvoiceHistoryLayout
      filters={filters}
      searchValue={filters.search}
      checkingAccess
    >
      <InvoiceHistoryResults
        filters={filters}
        loadingLabel="Checking your access…"
      />
    </InvoiceHistoryLayout>
  );
}
