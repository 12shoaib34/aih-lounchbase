"use client";
import { PaginationControls } from "@/components/ui/Pagination";
import { AuditResultsSkeleton } from "./AdminSkeletons";
import { pageDescriptions } from "@/app/pageMetadata";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminLoadingContent } from "@/app/AdminLoadingContent";
import { adminNavigation } from "@/app/adminNavigation";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "@/navigation";
import { apiRequest, ApiError } from "@/api/client";
import { WorkspaceFrame } from "@/app/WorkspaceFrame";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { accessSchema, permissionLabels } from "../../../shared/access";
import {
  auditAction,
  auditLabels,
  auditPageSchema,
} from "../../../shared/audit";

const auditPermissionLabels = {
  ...permissionLabels,
  "scheduling:read": "View all bookings (retired)",
  "scheduling:resources": "Create scheduling resources (retired)",
  "scheduling:cancel": "Cancel any booking (retired)",
};
function grants(permissions: (keyof typeof auditPermissionLabels)[]) {
  return permissions.length
    ? permissions.map((value) => auditPermissionLabels[value]).join(", ")
    : "No delegated permissions";
}
export function AuditPage() {
  const cache = useQueryClient();
  const access = useQuery({
    queryKey: ["audit", "access"],
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => apiRequest("/admin", { signal }, accessSchema),
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["audit"] });
    },
    [cache],
  );
  return (
    <WorkspaceFrame
      title="Administration"
      context="Client workspace"
      navigationLoading={access.isPending}
      links={adminNavigation(access.isError ? undefined : access.data)}
    >
      <PageHeader
        title="Audit trail"
        description={pageDescriptions["Audit trail"]}
      />
      {access.isPending ? (
        <AdminLoadingContent title="Audit trail" />
      ) : access.isError || access.data.teamRole !== "owner" ? (
        <section className="component-card access-message">
          <h2>Owner access required</h2>
          <p role="alert">
            {access.error instanceof ApiError && access.error.status === 401
              ? "Sign in with the owner account to review the audit trail."
              : "The audit trail is available only to the owner. Your access may have changed."}
          </p>
          <Link to="/account">Go to account access</Link>
          <Button onClick={() => void access.refetch()}>Check again</Button>
        </section>
      ) : (
        <AuditFeed userId={access.data.userId} />
      )}
    </WorkspaceFrame>
  );
}
function AuditFeed({ userId }: { userId: string }) {
  const [params, setParams] = useSearchParams();
  const cache = useQueryClient();
  const queryString = params.toString();
  const events = useQuery({
    queryKey: ["audit", "events", userId, queryString],
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest(`/audit?${queryString}`, { signal }, auditPageSchema),
  });
  function newest() {
    const next = new URLSearchParams(params);
    next.delete("before");
    setParams(next);
    void cache.invalidateQueries({ queryKey: ["audit", "events", userId] });
  }
  return (
    <>
      <form
        className="audit-filters"
        key={queryString}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const key of ["action", "from", "to", "actor", "target"]) {
            const value = String(data.get(key) ?? "").trim();
            if (value) next.set(key, value);
          }
          setParams(next);
        }}
      >
        <SelectField
          label="Event type"
          name="action"
          defaultValue={params.get("action") ?? "all"}
        >
          <option value="all">All events</option>
          {auditAction.options.map((action) => (
            <option key={action} value={action}>
              {auditLabels[action]}
            </option>
          ))}
        </SelectField>
        <Field
          label="From date (UTC)"
          name="from"
          type="date"
          defaultValue={params.get("from") ?? ""}
        />
        <Field
          label="Through date (UTC)"
          name="to"
          type="date"
          defaultValue={params.get("to") ?? ""}
        />
        <details className="audit-reference-filters">
          <summary>Filter by actor or target reference</summary>
          <Field
            label="Actor reference"
            name="actor"
            maxLength={128}
            defaultValue={params.get("actor") ?? ""}
          />
          <Field
            label="Target reference"
            name="target"
            maxLength={128}
            defaultValue={params.get("target") ?? ""}
          />
          <p className="hint">
            References are available in each event’s details.
          </p>
        </details>
        <div className="account-actions">
          <Button type="submit">Apply audit filters</Button>
          <Button
            variant="secondary"
            onClick={() => setParams(new URLSearchParams())}
          >
            Reset audit filters
          </Button>
        </div>
      </form>
      <div className="record-toolbar">
        <p className="hint">
          Names reflect current accounts. Event references remain when an
          account is deleted.
        </p>
        <Button
          variant="secondary"
          disabled={events.isFetching}
          onClick={newest}
        >
          Refresh audit trail
        </Button>
      </div>
      {events.isPending ? (
        <AuditResultsSkeleton />
      ) : events.isError ? (
        <section className="component-card">
          <p role="alert">
            {events.error instanceof ApiError
              ? events.error.message
              : "The audit trail could not be loaded."}
          </p>
          <Button onClick={() => void events.refetch()}>
            Retry audit request
          </Button>
        </section>
      ) : (
        <>
          <p role="status">
            Showing {events.data.items.length} event
            {events.data.items.length === 1 ? "" : "s"}
            {events.isFetching ? " · Updating…" : ""}
          </p>
          {events.data.items.length ? (
            <ol className="audit-list">
              {events.data.items.map((event) => (
                <li key={event.id}>
                  <article
                    className="component-card"
                    aria-label={`Audit event ${event.id}`}
                  >
                    <div className="audit-event-heading">
                      <h2>{auditLabels[event.action]}</h2>
                      <time dateTime={event.occurredAt}>
                        {new Date(event.occurredAt).toLocaleString()}
                      </time>
                    </div>
                    <p>
                      <strong>By:</strong>{" "}
                      {event.actorType === "operator"
                        ? "Deployment operator"
                        : event.actorType === "service"
                          ? "Stripe webhook"
                          : (event.actorName ?? "Account no longer available")}
                    </p>
                    <p>
                      <strong>
                        {event.targetType === "invitation"
                          ? "Invitation:"
                          : event.targetType === "account"
                            ? "Account:"
                            : `${event.targetType.charAt(0).toUpperCase()}${event.targetType.slice(1)}:`}
                      </strong>{" "}
                      {event.targetName ??
                        (["account", "invitation"].includes(event.targetType)
                          ? "Reference retained; current details unavailable"
                          : "See target reference below")}
                    </p>
                    {event.beforePermissions !== null && (
                      <p>
                        <strong>Before:</strong>{" "}
                        {grants(event.beforePermissions)}
                      </p>
                    )}
                    {event.afterPermissions !== null && (
                      <p>
                        <strong>After:</strong> {grants(event.afterPermissions)}
                      </p>
                    )}
                    <details>
                      <summary>Event references</summary>
                      <dl className="audit-references">
                        <dt>Event</dt>
                        <dd>{event.id}</dd>
                        {event.actorId && (
                          <>
                            <dt>Actor reference</dt>
                            <dd>{event.actorId}</dd>
                          </>
                        )}
                        <dt>Target</dt>
                        <dd>{event.targetId}</dd>
                        {event.requestId && (
                          <>
                            <dt>Request</dt>
                            <dd>{event.requestId}</dd>
                          </>
                        )}
                      </dl>
                    </details>
                  </article>
                </li>
              ))}
            </ol>
          ) : (
            <section className="component-card">
              <h2>No audit events found</h2>
              <p>
                Try different filters. Only changes recorded since audit logging
                was enabled appear here.
              </p>
            </section>
          )}
          <PaginationControls
            label="Audit event pages"
            indicator={
              params.has("before") ? "Earlier events" : "Latest events"
            }
            previousLabel="Newest events"
            nextLabel="Older events"
            previousDisabled={!params.has("before") || events.isFetching}
            nextDisabled={!events.data.nextCursor || events.isFetching}
            onPrevious={newest}
            onNext={() => {
              const next = new URLSearchParams(params);
              next.set("before", events.data.nextCursor!);
              setParams(next);
            }}
          />
        </>
      )}
    </>
  );
}
