import { FormFeedback } from "@/components/ui/FormFeedback";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { PageLoading } from "@/components/ui/PageLoading";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { SelectField } from "@/components/ui/SelectField";
import {
  mailReviewSchema,
  mailAttemptsSchema,
  mailResultLabels,
} from "../../../shared/notifications";

export function MailReview({
  userId,
  canDeliver,
  canReview,
}: {
  userId: string;
  canDeliver: boolean;
  canReview: boolean;
}) {
  const confirmation = useConfirmation();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("failed");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const review = useQuery({
    queryKey: ["owner", "mail-review", userId, page, filter],
    queryFn: ({ signal }) =>
      apiRequest(
        `/notification-jobs/email-review?page=${page}&filter=${filter}`,
        { signal },
        mailReviewSchema,
      ),
    enabled: open,
    retry: false,
  });
  const history = useQuery({
    queryKey: ["owner", "mail-attempts", userId, selected?.id],
    queryFn: ({ signal }) =>
      apiRequest(
        `/notification-jobs/${selected!.id}/email-attempts`,
        { signal },
        mailAttemptsSchema,
      ),
    enabled: open && !!selected,
    retry: false,
  });
  async function refresh() {
    await Promise.all([
      cache.invalidateQueries({ queryKey: ["owner", "mail-review", userId] }),
      cache.invalidateQueries({ queryKey: ["owner", "mail-attempts", userId] }),
      cache.invalidateQueries({ queryKey: ["owner", "jobs", userId] }),
    ]);
  }
  async function act(path: string, data?: object) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
      });
      await refresh();
      setMessage(
        data
          ? "Marked reviewed. No email was resent."
          : "Due email jobs processed (up to 5). Retry limits remain unchanged.",
      );
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "The action failed. Refresh and try again.",
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
      <summary>Email delivery review</summary>
      <p>
        Provider acceptance does not confirm inbox delivery. Unknown outcomes
        may already have sent an email. Failed jobs need operator investigation
        before creating a replacement message.
      </p>
      <p>
        Processing respects backoff, five attempts and the 23-hour retry window.
        Marking reviewed only acknowledges a failed job; it does not resend or
        reset limits.
      </p>
      <SelectField
        label="Email review filter"
        value={filter}
        onChange={(event) => {
          setFilter(event.target.value);
          setPage(1);
          setSelected(null);
        }}
      >
        <option value="failed">Failed emails</option>
        <option value="all">All email jobs</option>
      </SelectField>
      <div className="public-actions">
        {canDeliver && (
          <Button
            disabled={pending}
            onClick={() => void act("/notification-jobs/email-review/process")}
          >
            Process due email retries
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={pending || review.isFetching}
          onClick={() => void refresh()}
        >
          Refresh email review
        </Button>
      </div>
      {pending && <p role="status">Processing email action…</p>}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} focus={false} />
      {review.isPending ? (
        open && <PageLoading label="Loading email jobs…" layout="inline" />
      ) : review.isError ? (
        <p role="alert">
          Email jobs could not be loaded. Refresh to try again.
        </p>
      ) : (
        <>
          <DataTable
            caption="Email delivery jobs"
            rows={review.data.items}
            rowKey={(row) => row.id}
            empty="No email jobs match this filter."
            columns={[
              {
                key: "title",
                label: "Message",
                render: (row) => (
                  <>
                    {row.title}
                    <br />
                    <small className="field-hint">
                      Recipient reference: {row.recipientId}
                    </small>
                  </>
                ),
              },
              {
                key: "state",
                label: "Delivery",
                render: (row) => (
                  <>
                    {row.state} · {row.attempts}/5 attempts
                    <p>
                      {row.lastResult
                        ? (mailResultLabels[row.lastResult] ?? row.lastResult)
                        : "No result recorded"}
                    </p>
                    {row.state === "pending" && (
                      <p>
                        {row.retryWindowExpired
                          ? "Retry window expired"
                          : `Next eligible: ${new Date(row.nextAttemptAt).toLocaleString()}`}
                      </p>
                    )}
                  </>
                ),
              },
              {
                key: "review",
                label: "Review",
                render: (row) =>
                  row.reviewedAt ? (
                    <>
                      Reviewed {new Date(row.reviewedAt).toLocaleString()}
                      <p>Owner reference: {row.reviewedBy ?? "Former owner"}</p>
                    </>
                  ) : (
                    "Not reviewed"
                  ),
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="file-actions">
                    <Button
                      variant="secondary"
                      aria-label={`View attempts for ${row.title}`}
                      onClick={() =>
                        setSelected({ id: row.id, title: row.title })
                      }
                    >
                      View attempts
                    </Button>
                    {canReview && row.state === "failed" && !row.reviewedAt && (
                      <Button
                        disabled={pending}
                        aria-label={`Mark reviewed: ${row.title}`}
                        onClick={async () => {
                          if (
                            await confirmation.confirm(
                              `Mark ${row.title} reviewed? This does not resend the email or confirm delivery.`,
                              {
                                title: "Mark email reviewed?",
                                confirmLabel: "Mark reviewed",
                              },
                            )
                          )
                            void act(
                              `/notification-jobs/${row.id}/email-review`,
                              { attempts: row.attempts },
                            );
                        }}
                      >
                        Mark reviewed
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            label="Email review pages"
            page={page}
            pageSize={20}
            total={review.data.total}
            disabled={review.isFetching || pending}
            onPageChange={setPage}
          />
        </>
      )}
      {selected && (
        <section aria-label="Selected email attempts">
          <h3>Attempts: {selected.title}</h3>
          {history.isPending ? (
            <PageLoading label="Loading attempts…" layout="inline" />
          ) : history.isError ? (
            <p role="alert">
              Attempt history could not be loaded. Refresh to try again.
            </p>
          ) : (
            <DataTable
              caption="Email attempt history"
              rows={history.data.items}
              rowKey={(row) => String(row.attempt)}
              empty="No attempt history recorded; older attempts are not reconstructed."
              columns={[
                {
                  key: "attempt",
                  label: "Attempt",
                  render: (row) => row.attempt,
                },
                {
                  key: "started",
                  label: "Started",
                  render: (row) => new Date(row.startedAt).toLocaleString(),
                },
                {
                  key: "finished",
                  label: "Finished",
                  render: (row) =>
                    row.finishedAt
                      ? new Date(row.finishedAt).toLocaleString()
                      : "In progress",
                },
                {
                  key: "outcome",
                  label: "Result",
                  render: (row) => mailResultLabels[row.outcome] ?? row.outcome,
                },
              ]}
            />
          )}
        </section>
      )}
    </details>
  );
}
