"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { InvoiceHistorySkeleton } from "./InvoiceHistoryLayout";
import { CustomerInvoicesSkeleton } from "../workspace/WorkspaceSkeletons";
import { InvoiceList } from "./InvoiceList";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { apiRequest, ApiError } from "@/api/client";
import { invoicesSchema, formatMoney } from "../../../shared/billing";

export function BillingPage() {
  return (
    <OwnerPage
      contentHeader
      title="Billing"
      permission="billing:read"
      loading={<InvoiceHistorySkeleton />}
    >
      {(userId, permissions) => (
        <InvoiceList
          key={permissions.join(",")}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}
export function CustomerBillingPage() {
  return (
    <>
      <h1>My billing</h1>
      <Billing />
    </>
  );
}
function Billing() {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["billing", "customer"],
    queryFn: ({ signal }) =>
      apiRequest("/billing?scope=mine", { signal }, invoicesSchema),
    retry: false,
    staleTime: 0,
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["billing"] });
    },
    [cache],
  );
  return (
    <>
      <p className="lede">
        Review your issued invoices. Payments may take a moment to confirm;
        refresh to check their status.
      </p>
      <FormFeedback message={error} error />
      {pending && <p role="status">Opening secure checkout…</p>}
      <Button variant="secondary" onClick={() => void query.refetch()}>
        Refresh invoices
      </Button>
      {query.isPending ? (
        <CustomerInvoicesSkeleton />
      ) : query.isError ? (
        <p role="alert">
          Invoices could not be loaded. Sign in or refresh to try again.
        </p>
      ) : (
        <>
          <p>Latest {query.data.items.length} invoices (up to 100).</p>
          {!query.data.items.length && <p>No invoices yet.</p>}
          {query.data.items.map((invoice) => (
            <article className="component-card" key={invoice.id}>
              <h2>
                Invoice {invoice.number} ·{" "}
                {formatMoney(invoice.total ?? invoice.amount, invoice.currency)}
              </h2>
              <p>
                {invoice.customerName} ·{" "}
                {invoice.partial ? "Partially paid" : invoice.status}
              </p>
              <p>
                Balance due:{" "}
                {formatMoney(
                  invoice.status === "issued" ? invoice.amount : 0,
                  invoice.currency,
                )}
              </p>
              <ul>
                {invoice.items.map((item, index) => (
                  <li key={index}>
                    {item.description} — {item.quantity} ×{" "}
                    {formatMoney(item.unitAmount, invoice.currency)}
                  </li>
                ))}
              </ul>
              {!!invoice.receipts?.length && (
                <details>
                  <summary>Payment history</summary>
                  <ul>
                    {invoice.receipts.map((receipt, index) => (
                      <li key={index}>
                        {receipt.date} ·{" "}
                        {formatMoney(receipt.amount, invoice.currency)} ·{" "}
                        {receipt.method}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {invoice.paymentSource && (
                <p>
                  Payment recorded through{" "}
                  {invoice.paymentSource === "manual"
                    ? "an external payment reference"
                    : "Stripe"}
                  . Reference: {invoice.paymentReference}
                </p>
              )}
              {invoice.status === "issued" && query.data.checkout && (
                <Button
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      const result = await apiRequest(
                        `/billing/${invoice.id}/checkout`,
                        { method: "POST" },
                        z.object({ url: z.url() }),
                      );
                      const url = new URL(result.url);
                      if (
                        url.protocol !== "https:" ||
                        url.hostname !== "checkout.stripe.com"
                      )
                        throw new Error();
                      window.location.assign(url.href);
                    } catch (failure) {
                      setError(
                        failure instanceof ApiError
                          ? failure.message
                          : "Online checkout could not be started. Contact the business before trying another payment.",
                      );
                      setPending(false);
                    }
                  }}
                >
                  Pay invoice {invoice.number}
                </Button>
              )}
            </article>
          ))}
        </>
      )}
    </>
  );
}
