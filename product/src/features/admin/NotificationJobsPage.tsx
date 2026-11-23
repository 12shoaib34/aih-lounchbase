"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { LoadingTable } from "@/components/ui/LoadingContent";
import { MailReview } from "./MailReview";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { apiRequest, ApiError } from "@/api/client";
import { accountChoicesSchema, type Permission } from "../../../shared/access";
import { jobsSchema } from "../../../shared/notifications";

export function NotificationJobsPage() {
  return (
    <OwnerPage title="Scheduled notifications" permission="notifications:read">
      {(userId, permissions) => (
        <Jobs
          key={permissions.join(",")}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}
function Jobs({
  userId,
  permissions,
}: {
  userId: string;
  permissions: Permission[];
}) {
  const confirmation = useConfirmation();
  const canWrite = permissions.includes("notifications:write");
  const canDeliver = permissions.includes("notifications:deliver");
  const canReview = permissions.includes("notifications:review");
  const [search, setSearch] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState(false);
  const [due, setDue] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [immediate, setImmediate] = useState(() => new Date().toISOString());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const accounts = useQuery({
    queryKey: ["owner", "recipients", userId, search],
    enabled: canWrite,
    queryFn: ({ signal }) =>
      apiRequest(
        `/admin/account-choices?${new URLSearchParams({ search, purpose: "notifications" })}`,
        { signal },
        accountChoicesSchema,
      ),
    retry: false,
  });
  const jobs = useQuery({
    queryKey: ["owner", "jobs", userId],
    queryFn: ({ signal }) =>
      apiRequest("/notification-jobs", { signal }, jobsSchema),
    retry: false,
  });
  async function act(path: string, data?: object) {
    if (pending) return false;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await apiRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: data ? JSON.stringify(data) : undefined,
      });
      await jobs.refetch();
      return true;
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "The action failed. Try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <p className="lede">
        Review scheduled messages and email delivery history.
        {canWrite &&
          " You can schedule and cancel messages; optional email is limited to recipients who opted in."}
        {canDeliver &&
          " Use Deliver due notifications to process due messages."}
      </p>
      {canWrite && (
        <>
          {" "}
          <form
            className="directory-search"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(
                String(new FormData(event.currentTarget).get("search") ?? ""),
              );
              setRecipientId("");
            }}
          >
            <Field label="Find recipient" name="search" maxLength={100} />
            <Button type="submit">Find accounts</Button>
          </form>
          <form
            className="component-card"
            onSubmit={async (event) => {
              event.preventDefault();
              const dueAt = due ? new Date(due).toISOString() : immediate;
              if (
                await act("/notification-jobs", {
                  id: requestId,
                  recipientId,
                  title,
                  body,
                  dueAt,
                  email,
                })
              ) {
                setRequestId(crypto.randomUUID());
                setImmediate(new Date().toISOString());
                setTitle("");
                setBody("");
                setDue("");
                setMessage("Notification scheduled.");
              }
            }}
          >
            <fieldset
              disabled={pending}
              className="settings-fields form-columns"
            >
              <legend>Message</legend>
              <label>
                <input
                  type="checkbox"
                  checked={email}
                  onChange={(event) => setEmail(event.target.checked)}
                />{" "}
                Also email if recipient opted in
              </label>
              <SelectField
                label="Recipient"
                required
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
              >
                <option value="">Choose an account</option>
                {accounts.data?.items.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} — {account.email}
                  </option>
                ))}
              </SelectField>
              {accounts.isError && (
                <p role="alert">
                  Recipients could not be loaded. Try the search again.
                </p>
              )}
              <Field
                label="Title"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <TextAreaField
                label="Message"
                required
                maxLength={2000}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Field
                label="Delivery time (your local timezone; blank for now)"
                type="datetime-local"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </fieldset>
            <Button type="submit" disabled={pending}>
              Schedule notification
            </Button>
          </form>
        </>
      )}
      {canDeliver && (
        <Button
          disabled={pending}
          onClick={async () => {
            if (await act("/notification-jobs/deliver"))
              setMessage(
                "Due notifications processed. Each run handles up to 50 in-app messages and 5 emails.",
              );
          }}
        >
          Deliver due notifications
        </Button>
      )}
      {pending && <p role="status">Processing notification action…</p>}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} focus={false} />
      <MailReview
        userId={userId}
        canDeliver={canDeliver}
        canReview={canReview}
      />
      <h2>Latest 100 notifications</h2>
      {jobs.isPending ? (
        <LoadingTable
          label="Loading scheduled messages…"
          columns={["Title", "Due", "State", "Email", "Actions"]}
        />
      ) : jobs.isError ? (
        <>
          <p role="alert">Scheduled notifications could not be loaded.</p>
          <Button onClick={() => void jobs.refetch()}>Refresh</Button>
        </>
      ) : (
        <DataTable
          caption="Scheduled notifications"
          rows={jobs.data.items}
          rowKey={(row) => row.id}
          empty="No notifications scheduled."
          columns={[
            { key: "title", label: "Title", render: (row) => row.title },
            {
              key: "due",
              label: "Due",
              render: (row) => new Date(row.dueAt).toLocaleString(),
            },
            { key: "state", label: "State", render: (row) => row.state },
            {
              key: "email",
              label: "Email",
              render: (row) =>
                row.emailState === "accepted"
                  ? "Accepted by provider / local outbox"
                  : (row.emailState ?? "Not requested"),
            },
            {
              key: "cancel",
              label: "Actions",
              render: (row) =>
                row.state === "pending" && canWrite ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={async () => {
                      if (
                        await confirmation.confirm(`Cancel ${row.title}?`, {
                          title: "Cancel notification?",
                          confirmLabel: "Cancel notification",
                        })
                      )
                        if (await act(`/notification-jobs/${row.id}/cancel`))
                          setMessage("Notification cancelled.");
                    }}
                  >
                    Cancel {row.title}
                  </Button>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      )}
    </>
  );
}
