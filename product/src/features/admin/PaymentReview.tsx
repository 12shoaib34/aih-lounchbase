import { useFeedbackNotice } from "@/components/ui/useFeedbackNotice";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { PageLoading } from "@/components/ui/PageLoading";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { paymentReviewSchema } from "../../../shared/billing";

export function PaymentReview({ userId }: { userId: string }) {
  const confirmation = useConfirmation();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  useFeedbackNotice(feedback, failed, feedbackRef);
  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);
  const query = useQuery({
    queryKey: ["owner", "payment-review", userId],
    queryFn: ({ signal }) =>
      apiRequest("/billing/review", { signal }, paymentReviewSchema),
    retry: false,
    enabled: open,
  });
  async function reconcile(invoiceId: string) {
    if (
      pending ||
      !(await confirmation.confirm(
        "Check the recorded session with the provider and mark this invoice paid only if payment is confirmed? This does not create a charge or reset checkout.",
        { title: "Verify payment?", confirmLabel: "Verify payment" },
      ))
    )
      return;
    setPending(true);
    setFeedback("");
    setFailed(false);
    try {
      await apiRequest(`/billing/${invoiceId}/reconcile`, { method: "POST" });
      await Promise.all([
        query.refetch(),
        cache.invalidateQueries({ queryKey: ["billing"] }),
      ]);
      setFeedback(
        "Provider payment confirmed. Invoice marked paid; review events remain available for investigation.",
      );
    } catch (error) {
      setFailed(true);
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Verification could not finish. Refresh the invoice before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  async function recover(
    invoiceId: string,
    sessionId: string,
    version: number,
  ) {
    if (
      pending ||
      !(await confirmation.confirm(
        "Verify that this checkout is expired and unpaid, then allow a future checkout? No charge will be created now. Uncertain payments remain blocked.",
        { title: "Recover checkout?", confirmLabel: "Recover checkout" },
      ))
    )
      return;
    setPending(true);
    setFeedback("");
    setFailed(false);
    try {
      await apiRequest(`/billing/${invoiceId}/recover-checkout`, {
        method: "POST",
        body: JSON.stringify({ sessionId, version }),
      });
      await Promise.all([
        query.refetch(),
        cache.invalidateQueries({ queryKey: ["billing"] }),
      ]);
      setFeedback(
        "Expired checkout recovered. No charge was created; a new checkout can now be requested.",
      );
    } catch (error) {
      setFailed(true);
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Recovery could not finish. Refresh before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  async function linkSession(invoiceId: string, version: number) {
    if (pending) return;
    const sessionId = (
      await confirmation.prompt(
        "Enter the Checkout Session ID found in your provider dashboard for this invoice. The server will verify its attempt identity. Linking does not confirm payment or start checkout.",
        {
          title: "Link checkout session",
          confirmLabel: "Link session",
          inputLabel: "Checkout session ID",
        },
      )
    )?.trim();
    if (!sessionId) return;
    setPending(true);
    setFeedback("");
    setFailed(false);
    try {
      await apiRequest(`/billing/${invoiceId}/link-session`, {
        method: "POST",
        body: JSON.stringify({ sessionId, version }),
      });
      await query.refetch();
      setFeedback(
        "Checkout session linked. Verify payment or investigate the recorded session; no charge was created.",
      );
    } catch (error) {
      setFailed(true);
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Session could not be linked. Refresh before retrying.",
      );
    } finally {
      setPending(false);
    }
  }
  async function acknowledge(eventId: string) {
    if (
      pending ||
      !(await confirmation.confirm(
        "Acknowledge that you investigated this event? This does not confirm payment, resolve the checkout block or permit another charge.",
        { title: "Acknowledge review?", confirmLabel: "Acknowledge review" },
      ))
    )
      return;
    setPending(true);
    setFeedback("");
    setFailed(false);
    try {
      await apiRequest("/billing/review/acknowledge", {
        method: "POST",
        body: JSON.stringify({ eventId }),
      });
      await query.refetch();
      setFeedback(
        "Review acknowledged. Payment status and checkout restrictions are unchanged.",
      );
    } catch (error) {
      setFailed(true);
      setFeedback(
        error instanceof ApiError
          ? error.message
          : "Could not acknowledge this event. Refresh and try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <details
      className="component-card"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>Payment review</summary>
      <p>
        Review payment-provider events and open checkout attempts. A review
        outcome or an old attempt needs reconciliation with your payment
        operator before collecting another payment. These lists show up to 100
        records each, with unacknowledged review events first. Only the owner
        can acknowledge investigation; this does not resolve, refund or unblock
        payments. Owners can verify a recorded session with the provider to
        recover a confirmed payment. Expired or unpaid sessions and attempts
        without a recorded session still need operator investigation.
      </p>
      <Button variant="secondary" onClick={() => void query.refetch()}>
        Refresh payment review
      </Button>
      {pending && <p role="status">Processing payment review…</p>}
      {feedback && (
        <p
          className={`form-feedback${failed ? " form-feedback-error" : ""}`}
          ref={feedbackRef}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
        >
          {feedback}
        </p>
      )}
      {query.isPending ? (
        open && <PageLoading label="Loading payment review…" layout="inline" />
      ) : query.isError ? (
        <p role="alert">Payment review could not be loaded.</p>
      ) : (
        <>
          <DataTable
            caption="Provider events — unacknowledged reviews first"
            rows={query.data.events}
            rowKey={(row) => row.id}
            empty="No provider events recorded."
            columns={[
              {
                key: "event",
                label: "Event reference",
                render: (row) => row.id,
              },
              {
                key: "invoice",
                label: "Invoice reference",
                render: (row) => row.invoiceId ?? "Unknown",
              },
              {
                key: "outcome",
                label: "Outcome",
                render: (row) => row.outcome,
              },
              {
                key: "acknowledgement",
                label: "Investigation",
                render: (row) =>
                  row.outcome !== "review" ? (
                    "Not required"
                  ) : row.acknowledgedAt ? (
                    `Acknowledged ${new Date(row.acknowledgedAt).toLocaleString()} · ${row.acknowledgedBy ?? "Former owner"}`
                  ) : query.data.canAcknowledge ? (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => void acknowledge(row.id)}
                    >
                      Acknowledge {row.id}
                    </Button>
                  ) : (
                    "Awaiting owner acknowledgement"
                  ),
              },
              {
                key: "date",
                label: "Received",
                render: (row) => new Date(row.createdAt).toLocaleString(),
              },
            ]}
          />
          <DataTable
            caption="Recovered checkout history (latest 100)"
            rows={query.data.recoveries}
            rowKey={(row) => row.sessionId}
            empty="No recovered checkouts."
            columns={[
              {
                key: "invoice",
                label: "Invoice reference",
                render: (row) => row.invoiceId,
              },
              {
                key: "session",
                label: "Expired session",
                render: (row) => row.sessionId,
              },
              {
                key: "date",
                label: "Recovered",
                render: (row) => new Date(row.recoveredAt).toLocaleString(),
              },
            ]}
          />
          <DataTable
            caption="Unconfirmed checkout attempts"
            rows={query.data.attempts}
            rowKey={(row) => row.id}
            empty="No unconfirmed checkout attempts."
            columns={[
              { key: "invoice", label: "Invoice", render: (row) => row.number },
              {
                key: "recover",
                label: "Expired checkout",
                render: (row) =>
                  row.sessionId && query.data.canReconcile ? (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() =>
                        void recover(row.id, row.sessionId!, row.version)
                      }
                    >
                      Recover expired checkout for invoice {row.number}
                    </Button>
                  ) : (
                    "Operator investigation required"
                  ),
              },
              {
                key: "verify",
                label: "Provider verification",
                render: (row) =>
                  !row.sessionId ? (
                    row.canLinkSession && query.data.canReconcile ? (
                      <Button
                        disabled={pending}
                        variant="secondary"
                        onClick={() => void linkSession(row.id, row.version)}
                      >
                        Link provider session for invoice {row.number}
                      </Button>
                    ) : (
                      "Legacy or unavailable attempt; investigate with operator"
                    )
                  ) : query.data.canReconcile ? (
                    <Button
                      disabled={pending}
                      variant="secondary"
                      onClick={() => void reconcile(row.id)}
                    >
                      Verify payment for invoice {row.number}
                    </Button>
                  ) : (
                    "Owner and configured provider required"
                  ),
              },
              {
                key: "attempt",
                label: "First attempted",
                render: (row) => new Date(row.attemptedAt).toLocaleString(),
              },
              {
                key: "session",
                label: "Checkout reference",
                render: (row) => row.sessionId ?? "Response not recorded",
              },
            ]}
          />
        </>
      )}
    </details>
  );
}
