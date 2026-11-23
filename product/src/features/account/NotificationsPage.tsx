"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Pagination } from "@/components/ui/Pagination";
import {
  InboxSkeleton,
  InboxPreferencesSkeleton,
} from "../workspace/WorkspaceSkeletons";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { notificationsSchema } from "../../../shared/notifications";

export function NotificationsPage() {
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [pendingEmail, setPendingEmail] = useState<boolean | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const [preferenceError, setPreferenceError] = useState("");
  const [preferenceMessage, setPreferenceMessage] = useState("");
  const [reading, setReading] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  async function savePreference(email: boolean) {
    if (savingPreference) return;
    setPendingEmail(email);
    setSavingPreference(true);
    setPreferenceError("");
    setPreferenceMessage("");
    try {
      await apiRequest("/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      cache.setQueryData(["inbox", "preferences"], { email });
      setPendingEmail(null);
      setPreferenceMessage("Email preference saved.");
    } catch {
      setPreferenceError(
        "Could not save your email preference. Retry to save your selection.",
      );
    } finally {
      setSavingPreference(false);
    }
  }
  const preferences = useQuery({
    queryKey: ["inbox", "preferences"],
    queryFn: ({ signal }) =>
      apiRequest(
        "/notifications/preferences",
        { signal },
        z.object({ email: z.boolean() }),
      ),
    retry: false,
    staleTime: 0,
  });
  const query = useQuery({
    queryKey: ["inbox", page],
    queryFn: ({ signal }) =>
      apiRequest(
        `/notifications?page=${page}`,
        { signal },
        notificationsSchema,
      ),
    retry: false,
    staleTime: 0,
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["inbox"] });
    },
    [cache],
  );
  return (
    <>
      <h1>Notifications</h1>
      <Button variant="secondary" onClick={() => void query.refetch()}>
        Refresh notifications
      </Button>
      {preferences.isPending && <InboxPreferencesSkeleton />}
      {preferences.data && (
        <div className="component-card">
          <label>
            <input
              type="checkbox"
              aria-describedby="notification-email-help"
              checked={pendingEmail ?? preferences.data.email}
              disabled={savingPreference}
              onChange={(event) => void savePreference(event.target.checked)}
            />{" "}
            Email me optional account notifications
          </label>
          <span className="hint" id="notification-email-help">
            Off by default. Security and account recovery emails are always
            sent. A message already being sent may still arrive after you opt
            out.
          </span>
          <FormFeedback
            message={
              savingPreference ? "Saving preference…" : preferenceMessage
            }
            focus={false}
          />
          <FormFeedback message={preferenceError} error focus={false} />
          {preferenceError && pendingEmail !== null && (
            <Button
              variant="secondary"
              disabled={savingPreference}
              onClick={() => void savePreference(pendingEmail)}
            >
              Retry saving preference
            </Button>
          )}
        </div>
      )}
      {preferences.isError && (
        <p role="alert">
          Email preferences could not be loaded.{" "}
          <Button onClick={() => void preferences.refetch()}>
            Retry preferences
          </Button>
        </p>
      )}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} />
      {query.isPending ? (
        <InboxSkeleton />
      ) : query.isError ? (
        <p role="alert">
          Sign in to view your notifications, or refresh to try again.
        </p>
      ) : (
        <>
          {!query.data.items.length && <p>No notifications yet.</p>}
          {query.data.items.map((item) => (
            <article className="component-card" key={item.id}>
              <h2>{item.title}</h2>
              <p className="hint">
                {new Date(item.createdAt).toLocaleString()} ·{" "}
                {item.read ? "Read" : "Unread"}
              </p>
              <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {item.body}
              </p>
              {!item.read && (
                <Button
                  variant="secondary"
                  disabled={reading !== null}
                  onClick={async () => {
                    if (reading) return;
                    setReading(item.id);
                    setMessage("");
                    setError("");
                    try {
                      await apiRequest(`/notifications/${item.id}/read`, {
                        method: "POST",
                      });
                      await query.refetch();
                      setMessage("Notification marked as read.");
                    } catch {
                      setError("Could not mark the notification as read.");
                    } finally {
                      setReading(null);
                    }
                  }}
                >
                  {reading === item.id ? "Marking as read…" : "Mark as read"}
                </Button>
              )}
            </article>
          ))}
          <Pagination
            label="Notification pages"
            page={page}
            pageSize={20}
            total={query.data.total}
            disabled={query.isFetching}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
