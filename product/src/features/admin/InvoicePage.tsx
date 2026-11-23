"use client";
import { useFeedbackNotice } from "@/components/ui/useFeedbackNotice";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { InvoiceEditorSkeleton } from "./InvoiceEditorSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { InvoiceReviewSkeleton } from "./InvoiceReviewSkeleton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { invoiceDownloadError } from "./invoiceDownloadError";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Link, useLocation } from "@/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { apiRequest, ApiError } from "@/api/client";
import {
  invoiceDefaultsSchema,
  invoiceDetailsSchema,
  invoiceTotals,
  invoiceLineAmount,
  formatMoney,
} from "../../../shared/billing";
import type { Permission } from "../../../shared/access";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import type { InvoiceDetails } from "../../../shared/billing";
import { InvoiceEditor } from "./InvoiceEditor";

export function InvoicePage({
  mode = "review",
}: {
  mode?: "new" | "edit" | "review";
}) {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  return (
    <OwnerPage
      contentHeader
      loading={
        mode === "review" ? (
          <InvoiceReviewSkeleton />
        ) : (
          <InvoiceEditorSkeleton mode={mode} />
        )
      }
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Billing", to: `/admin/billing${location.search}` },
            {
              label:
                mode === "new"
                  ? "New invoice"
                  : mode === "edit"
                    ? "Edit draft"
                    : "Invoice details",
            },
          ]}
        />
      }
      title={
        mode === "new"
          ? "New invoice"
          : mode === "edit"
            ? "Edit draft"
            : "Invoice details"
      }
      permission={
        mode === "new"
          ? "billing:create"
          : mode === "edit"
            ? "billing:edit"
            : "billing:read"
      }
    >
      {(userId, permissions) =>
        mode === "new" ? (
          <NewInvoice
            key={`${userId}:${permissions.join()}`}
            userId={userId}
            canUseContacts={permissions.includes("contacts:read")}
          />
        ) : (
          <InvoiceRecord
            key={`${id}:${mode}:${userId}:${permissions.join()}`}
            id={id!}
            mode={mode}
            userId={userId}
            permissions={permissions}
          />
        )
      }
    </OwnerPage>
  );
}
function NewInvoice({
  userId,
  canUseContacts,
}: {
  userId: string;
  canUseContacts: boolean;
}) {
  const location = useLocation();
  const header = (
    <PageHeader
      title="New invoice"
      breadcrumbs={
        <Breadcrumbs
          items={[
            { label: "Billing", to: `/admin/billing${location.search}` },
            { label: "New invoice" },
          ]}
        />
      }
    />
  );
  const query = useQuery({
    queryKey: ["billing", userId, "defaults"],
    queryFn: ({ signal }) =>
      apiRequest("/billing/defaults", { signal }, invoiceDefaultsSchema),
    retry: false,
    gcTime: 0,
  });
  if (query.isPending) return <InvoiceEditorSkeleton />;
  if (query.isError)
    return (
      <>
        {header}
        <p role="alert">Could not load invoice defaults.</p>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </>
    );
  return (
    <InvoiceEditor
      userId={userId}
      defaults={query.data}
      canUseContacts={canUseContacts}
    />
  );
}
function InvoiceRecord({
  id,
  mode,
  userId,
  permissions,
}: {
  id: string;
  mode: "edit" | "review";
  userId: string;
  permissions: Permission[];
}) {
  const confirmation = useConfirmation();
  const more = useRef<HTMLDetailsElement>(null);
  function closeMore(restoreFocus = false) {
    if (!more.current?.open) return;
    more.current.open = false;
    if (restoreFocus) more.current.querySelector("summary")?.focus();
  }
  function positionMore() {
    const panel = more.current?.querySelector<HTMLElement>(
      ".invoice-more-panel",
    );
    if (!more.current?.open || !panel) return;
    panel.style.transform = "";
    const bounds = panel.getBoundingClientRect();
    const offset =
      bounds.left < 8
        ? 8 - bounds.left
        : Math.min(0, window.innerWidth - 8 - bounds.right);
    panel.style.transform = `translateX(${offset}px)`;
  }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !more.current?.contains(event.target))
        closeMore();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", positionMore);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", positionMore);
    };
  }, []);

  const cache = useQueryClient();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceDetails | null>(
    null,
  );
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("saved-invoice") === id) {
        setMessage("Draft saved.");
        window.sessionStorage.removeItem("saved-invoice");
      }
    } catch {
      /* Storage is optional. */
    }
  }, [id]);
  useFeedbackNotice(error || message, !!error);
  const query = useQuery({
    queryKey: ["owner", "invoice", userId, id],
    queryFn: ({ signal }) =>
      apiRequest(
        `/billing/${encodeURIComponent(id)}`,
        { signal },
        invoiceDetailsSchema,
      ),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: mode !== "edit",
  });
  function refreshAccess(failure: unknown) {
    if (failure instanceof ApiError && [401, 403].includes(failure.status))
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  }
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      [401, 403].includes(query.error.status)
    )
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  }, [query.error, cache]);
  async function action(kind: "issue" | "void") {
    if (!query.data || pending) return;
    if (
      !(await confirmation.confirm(
        kind === "issue"
          ? `Issue invoice ${query.data.document.reference || query.data.number}? It will be locked for editing and available to any linked customer account. This does not email the invoice or charge the customer.`
          : `Void invoice ${query.data.document.reference || query.data.number}?`,
        {
          title: kind === "issue" ? "Issue invoice?" : "Void invoice?",
          confirmLabel: kind === "issue" ? "Issue invoice" : "Void invoice",
        },
      ))
    )
      return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(`/billing/${id}/action`, {
        method: "POST",
        body: JSON.stringify({
          action: kind,
          version: query.data.version,
        }),
      });
      await query.refetch();
      void cache.invalidateQueries({ queryKey: ["billing"] });
      setMessage("Invoice updated.");
    } catch (failure) {
      refreshAccess(failure);
      setError(
        failure instanceof ApiError
          ? failure.message
          : "Could not confirm the update. Refresh the invoice before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  const reference =
    query.data?.document.reference || query.data?.number || "Invoice details";
  const breadcrumbs = (
    <Breadcrumbs
      items={[
        { label: "Billing", to: `/admin/billing${location.search}` },
        {
          label: reference,
          ...(mode === "edit"
            ? { to: `/admin/billing/${id}${location.search}` }
            : {}),
        },
        ...(mode === "edit" ? [{ label: "Edit draft" }] : []),
      ]}
    />
  );
  if (query.isPending)
    return mode === "edit" ? (
      <InvoiceEditorSkeleton mode="edit" />
    ) : (
      <InvoiceReviewSkeleton />
    );
  if (query.isError)
    return (
      <>
        <PageHeader
          title={mode === "edit" ? "Edit draft" : "Invoice details"}
          breadcrumbs={breadcrumbs}
        />
        <p role="alert">
          {query.error instanceof ApiError && query.error.status === 404
            ? "Invoice not found. Return to Billing to find another invoice."
            : query.error instanceof ApiError &&
                [401, 403].includes(query.error.status)
              ? "Your access has changed. Check your permissions or sign in again."
              : "Could not load this invoice."}
        </p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Retry invoice
        </Button>
      </>
    );
  const invoice = query.data;
  if (mode === "edit")
    return (
      <>
        <InvoiceEditor
          userId={userId}
          initial={invoice}
          canUseContacts={permissions.includes("contacts:read")}
        />
      </>
    );
  const details = invoice.document;
  const totals = invoiceTotals(invoice);
  const paid =
    invoice.status === "paid"
      ? totals.total
      : invoice.status === "issued"
        ? totals.total - invoice.amount
        : totals.amountPaid;
  return (
    <div className="invoice-review">
      <PageHeader
        title="Invoice details"
        description={
          <>
            {reference} ·{" "}
            <span className={`billing-status billing-status-${invoice.status}`}>
              {invoice.partial ? "Partially paid" : invoice.status}
            </span>
          </>
        }
        breadcrumbs={breadcrumbs}
        actions={
          <div className="invoice-review-tools invoice-actions">
            <Button
              variant={
                invoice.status === "draft" &&
                permissions.includes("billing:issue")
                  ? "secondary"
                  : "primary"
              }
              disabled={pending}
              aria-label="Download PDF"
              onClick={async () => {
                if (pending) return;
                setDownloading(true);
                setMessage("Preparing PDF…");
                setPending(true);
                setError("");
                try {
                  const { downloadInvoice } = await import("./invoicePdf");
                  await downloadInvoice(invoice);
                  setMessage("PDF download started.");
                } catch (failure) {
                  setMessage("");
                  setError(invoiceDownloadError(failure));
                } finally {
                  setPending(false);
                  setDownloading(false);
                }
              }}
            >
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </Button>
            {invoice.status === "draft" &&
              permissions.includes("billing:edit") && (
                <Link
                  className="button button-secondary"
                  to={`/admin/billing/${id}/edit${location.search}`}
                >
                  Edit draft
                </Link>
              )}
            {invoice.status === "draft" &&
              permissions.includes("billing:issue") && (
                <Button disabled={pending} onClick={() => void action("issue")}>
                  Issue invoice
                </Button>
              )}
            {invoice.status === "issued" &&
              permissions.includes("billing:record-payment") && (
                <Button
                  disabled={pending || invoice.checkoutActive}
                  variant="secondary"
                  onClick={() => setPaymentInvoice(invoice)}
                >
                  Record payment
                </Button>
              )}
            {invoice.status === "issued" &&
              invoice.checkout &&
              permissions.includes("billing:checkout") && (
                <Button
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    setError("");
                    try {
                      const result = await apiRequest(
                        `/billing/${id}/checkout`,
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
                      refreshAccess(failure);
                      setError(
                        failure instanceof ApiError
                          ? failure.message
                          : "Could not start checkout. Contact the payment operator before trying another payment.",
                      );
                      setPending(false);
                    }
                  }}
                >
                  Pay invoice {invoice.number}
                </Button>
              )}
            <details
              ref={more}
              className="invoice-more"
              onToggle={positionMore}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget))
                  closeMore();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeMore(true);
                }
              }}
            >
              <summary>
                More actions <span aria-hidden="true">⌄</span>
              </summary>
              <div
                className="invoice-more-panel"
                role="group"
                aria-label="More invoice actions"
              >
                <Button
                  variant="secondary"
                  disabled={pending || query.isFetching}
                  onClick={() => {
                    closeMore(true);
                    void query.refetch();
                  }}
                >
                  Refresh invoice
                </Button>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={async () => {
                    closeMore(true);
                    if (pending) return;
                    // Open during the click, before loading the PDF module, to respect popup blockers.
                    const printWindow = window.open("", "_blank");
                    if (!printWindow) {
                      setError(
                        "Allow popups to print this invoice, or download the PDF and print it from your viewer.",
                      );
                      return;
                    }
                    printWindow.document.title = "Preparing invoice PDF";
                    printWindow.document.body.textContent =
                      "Preparing invoice PDF…";
                    setPending(true);
                    setPrinting(true);
                    setError("");
                    setMessage("Preparing PDF for printing…");
                    try {
                      const { printInvoice } = await import("./invoicePdf");
                      await printInvoice(invoice, printWindow);
                      setMessage(
                        "Print-ready PDF opened. Use your PDF viewer’s print control if printing does not start automatically.",
                      );
                    } catch {
                      printWindow.close();
                      setMessage("");
                      setError(
                        "Could not prepare the invoice for printing. Try again or download the PDF.",
                      );
                    } finally {
                      setPending(false);
                      setPrinting(false);
                    }
                  }}
                >
                  {printing ? "Preparing print…" : "Print"}
                </Button>
                {["draft", "issued"].includes(invoice.status) &&
                  !invoice.partial &&
                  permissions.includes("billing:void") && (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      className="invoice-more-danger"
                      onClick={() => {
                        closeMore(true);
                        void action("void");
                      }}
                    >
                      Void invoice
                    </Button>
                  )}
              </div>
            </details>
          </div>
        }
      />
      {paymentInvoice && (
        <RecordPaymentDialog
          invoice={paymentInvoice}
          onClose={() => setPaymentInvoice(null)}
          onRecorded={() => {
            setPaymentInvoice(null);
            setError("");
            setMessage("Payment recorded.");
            void query.refetch();
            void cache.invalidateQueries({ queryKey: ["billing"] });
          }}
        />
      )}
      {invoice.status === "issued" &&
        invoice.checkoutActive &&
        permissions.includes("billing:record-payment") && (
          <p>
            Resolve the open online checkout before recording a manual payment.
          </p>
        )}
      {pending && !message && <p role="status">Processing invoice action…</p>}
      {error && (
        <p
          className="invoice-notice form-feedback form-feedback-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {message && (
        <p className="invoice-notice form-feedback" role="status">
          {message}
        </p>
      )}
      <article
        className="invoice-sheet generator-saved"
        aria-label={`Invoice ${invoice.number}`}
      >
        <header className="invoice-sheet-heading">
          <div>
            {details.logo && (
              <img
                className="invoice-saved-logo"
                src={details.logo}
                alt="Invoice logo"
              />
            )}
          </div>
          <div className="generator-saved-title">
            <h2>{details.title}</h2>
            <p># {details.reference || invoice.number}</p>
            <p className="invoice-status">
              {invoice.partial ? "Partially paid" : invoice.status}
            </p>
          </div>
        </header>
        <div className="invoice-parties">
          <section>
            <h3>From</h3>
            <strong>
              {details.sellerName || "Seller details not recorded"}
            </strong>
            {details.sellerAddress && (
              <p className="invoice-multiline">{details.sellerAddress}</p>
            )}
            {details.sellerEmail && <p>{details.sellerEmail}</p>}
          </section>
          <section>
            <h3>Bill to</h3>
            <strong>{details.billToName || invoice.customerName}</strong>
            {details.billToEmail && <p>{details.billToEmail}</p>}
            {details.billToAddress && (
              <p className="invoice-multiline">{details.billToAddress}</p>
            )}
          </section>
          {details.shipTo && (
            <section>
              <h3>Ship to</h3>
              <p className="invoice-multiline">{details.shipTo}</p>
            </section>
          )}
        </div>
        {(details.invoiceDate ||
          details.dueDate ||
          details.paymentTerms ||
          details.purchaseOrder) && (
          <dl className="invoice-dates">
            {details.paymentTerms && (
              <div>
                <dt>Payment terms</dt>
                <dd>{details.paymentTerms}</dd>
              </div>
            )}
            {details.purchaseOrder && (
              <div>
                <dt>PO number</dt>
                <dd>{details.purchaseOrder}</dd>
              </div>
            )}
            {details.invoiceDate && (
              <div>
                <dt>Invoice date</dt>
                <dd>{details.invoiceDate}</dd>
              </div>
            )}
            {details.dueDate && (
              <div>
                <dt>Due date</dt>
                <dd>{details.dueDate}</dd>
              </div>
            )}
          </dl>
        )}
        <table className="invoice-lines">
          <caption className="sr-only">Invoice line items</caption>
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col">Quantity</th>
              <th scope="col">Unit price</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={index}>
                <th scope="row">{item.description}</th>
                <td data-label="Quantity">{item.quantity}</td>
                <td data-label="Unit price">
                  {formatMoney(item.unitAmount, invoice.currency)}
                </td>
                <td data-label="Amount">
                  {formatMoney(invoiceLineAmount(item), invoice.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="generator-saved-totals">
          {[
            ["Subtotal", totals.subtotal],
            ["Discount", totals.discount],
            ["Tax", totals.tax],
            ["Shipping", totals.shipping],
            ["Total", totals.total],
            ["Amount paid", paid],
            [
              "Balance due",
              invoice.status === "void" ? 0 : totals.total - paid,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{formatMoney(Number(value), invoice.currency)}</dd>
            </div>
          ))}
        </dl>
        {details.notes && (
          <section>
            <h3>Notes</h3>
            <p className="invoice-multiline">{details.notes}</p>
          </section>
        )}
        {details.terms && (
          <section>
            <h3>Payment terms</h3>
            <p className="invoice-multiline">{details.terms}</p>
          </section>
        )}
        {!!invoice.payments?.length && (
          <section>
            <h3>Payment history</h3>
            <ul>
              {invoice.payments.map((payment, index) => (
                <li key={index}>
                  {payment.date} ·{" "}
                  {formatMoney(payment.amount, invoice.currency)} ·{" "}
                  {payment.method} · {payment.reference}
                  {payment.actor && ` · Recorded by ${payment.actor}`}
                </li>
              ))}
            </ul>
          </section>
        )}
        {!invoice.payments?.length && invoice.paymentSource && (
          <p>
            Payment recorded through{" "}
            {invoice.paymentSource === "manual"
              ? "an external payment reference"
              : "Stripe"}
            . Reference: {invoice.paymentReference}
          </p>
        )}
        {invoice.status === "draft" && (
          <p className="hint">Draft — not issued.</p>
        )}
        {invoice.status === "void" && (
          <p className="hint">This invoice is void.</p>
        )}
      </article>
    </div>
  );
}
