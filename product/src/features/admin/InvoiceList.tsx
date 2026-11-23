import { PageHeader } from "@/components/ui/PageHeader";
import { pageDescriptions } from "@/app/pageMetadata";
import {
  InvoiceHistoryLayout,
  InvoiceHistoryResults,
} from "./InvoiceHistoryLayout";
import { useEffect, useState } from "react";
import { useLocation, useSearchParams } from "@/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { invoiceListQuery, invoiceListSchema } from "../../../shared/billing";
import type { Permission } from "../../../shared/access";
import { PaymentReview } from "./PaymentReview";

export function InvoiceList({
  userId,
  permissions,
}: {
  userId: string;
  permissions: Permission[];
}) {
  const cache = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const parsed = invoiceListQuery.safeParse(Object.fromEntries(params));
  const filters = parsed.success ? parsed.data : invoiceListQuery.parse({});
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(
    null,
  );
  const query = useQuery({
    queryKey: ["billing", userId, "list", filters],
    enabled: parsed.success,
    queryFn: ({ signal }) =>
      apiRequest(
        "/billing/list?" +
          new URLSearchParams({ ...filters, page: String(filters.page) }),
        { signal },
        invoiceListSchema,
      ),
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      [401, 403].includes(query.error.status)
    )
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  }, [query.error, cache]);
  function filter(changes: Partial<typeof filters>) {
    const current = invoiceListQuery.safeParse(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    );
    const next = { ...(current.success ? current.data : filters), ...changes };
    const params = new URLSearchParams();
    if (next.search) params.set("search", next.search);
    if (next.status !== "all") params.set("status", next.status);
    if (next.page !== 1) params.set("page", String(next.page));
    setDraft(null);
    setParams(params);
  }
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Billing" description={pageDescriptions.Billing} />
        <p role="alert">These invoice filters are invalid.</p>
        <Button onClick={() => setParams(new URLSearchParams())}>Reset filters</Button>
      </>
    );
  return (
    <InvoiceHistoryLayout
      filters={filters}
      searchValue={draft?.key === location.key ? draft.value : filters.search}
      onSearchValue={(value) => setDraft({ key: location.key, value })}
      onFilter={filter}
      canCreate={permissions.includes("billing:create")}
    >
      {query.isError ? (
        <>
          <p role="alert">Could not load invoices.</p>
          <Button onClick={() => void query.refetch()}>Retry invoices</Button>
        </>
      ) : (
        <InvoiceHistoryResults
          filters={filters}
          data={query.data}
          onPage={(page) => filter({ page })}
        />
      )}
      {permissions.includes("billing:review") && (
        <section className="billing-payment-review">
          <PaymentReview userId={userId} />
        </section>
      )}
    </InvoiceHistoryLayout>
  );
}
