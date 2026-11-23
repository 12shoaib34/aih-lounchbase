"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  ContactDetailsSkeleton,
  ContactDetailsBodySkeleton,
} from "./ContactsSkeleton";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocation } from "@/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { apiRequest, ApiError } from "@/api/client";
import {
  contactListQuery,
  contactSchema,
  type Contact,
} from "../../../shared/contacts";
import type { Permission } from "../../../shared/access";
import { ContactEditor } from "./ContactEditor";

function previousPageIs(path: string) {
  const navigation = (
    window as Window & {
      navigation?: {
        currentEntry: { index: number };
        entries(): { url: string }[];
      };
    }
  ).navigation;
  return (
    navigation?.entries()[navigation.currentEntry.index - 1]?.url ===
    new URL(path, location.origin).href
  );
}

export function ContactDetailsPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <OwnerPage
      contentHeader
      title="Contact details"
      permission="contacts:read"
      loading={<ContactDetailsSkeleton />}
    >
      {(userId, permissions) => (
        <ContactDetails
          key={id + ":" + userId + ":" + [...permissions].sort().join(",")}
          id={id!}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}

function ContactDetails({
  id,
  userId,
  permissions,
}: {
  id: string;
  userId: string;
  permissions: Permission[];
}) {
  const cache = useQueryClient();
  const location = useLocation();
  const router = useRouter();
  const [editor, setEditor] = useState<Contact | null>(null);
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["owner", "contact", userId, id],
    queryFn: ({ signal }) =>
      apiRequest(
        `/contacts/${encodeURIComponent(id)}`,
        { signal },
        contactSchema,
      ),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const refreshAccess = () =>
    void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      [401, 403].includes(query.error.status)
    )
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  }, [query.error, cache]);
  const filters = contactListQuery.safeParse(
    Object.fromEntries(new URLSearchParams(location.search)),
  );
  const returnParams = new URLSearchParams();
  if (filters.success) {
    if (filters.data.search) returnParams.set("search", filters.data.search);
    if (filters.data.status !== "active")
      returnParams.set("status", filters.data.status);
    if (filters.data.page !== 1)
      returnParams.set("page", String(filters.data.page));
  }
  const backUrl =
    "/admin/contacts" + (returnParams.size ? "?" + returnParams : "");
  const errorStatus =
    query.error instanceof ApiError ? query.error.status : undefined;
  return (
    <div className="contact-detail">
      <PageHeader
        title="Contact details"
        breadcrumbs={
          <Breadcrumbs
            items={[
              {
                label: "Contacts",
                to: backUrl,
                onClick: (event) => {
                  if (
                    previousPageIs("/app" + backUrl) &&
                    event.button === 0 &&
                    !event.metaKey &&
                    !event.ctrlKey &&
                    !event.shiftKey &&
                    !event.altKey
                  ) {
                    event.preventDefault();
                    router.back();
                  }
                },
              },
              { label: query.data?.data.name || "Contact details" },
            ]}
          />
        }
      />
      <FormFeedback message={message} focus={false} />
      {query.isPending ? (
        <ContactDetailsBodySkeleton
          canWrite={permissions.includes("contacts:write")}
        />
      ) : query.isError ? (
        <section className="portal-empty">
          <h2>
            {errorStatus === 404 ? "Contact not found" : "Contact unavailable"}
          </h2>
          <p role="alert">
            {errorStatus === 404
              ? "This contact no longer exists or the link is invalid."
              : errorStatus === 401 || errorStatus === 403
                ? "Your access has changed. Check your permissions or sign in again."
                : "We could not load this contact. Try again."}
          </p>
          {errorStatus !== 404 && (
            <Button
              onClick={() => {
                refreshAccess();
                void query.refetch();
              }}
            >
              Retry contact
            </Button>
          )}
        </section>
      ) : (
        <>
          <header className="contact-record-heading">
            <div>
              <h2>{query.data.data.name}</h2>
              <span
                className={`contact-status contact-status-${query.data.data.status}`}
              >
                {query.data.data.status === "active" ? "Active" : "Archived"}
              </span>
            </div>
            <div className="contact-record-actions">
              <Button
                variant="secondary"
                disabled={query.isFetching}
                onClick={() => {
                  refreshAccess();
                  void query.refetch();
                }}
              >
                Refresh contact
              </Button>
              {permissions.includes("contacts:write") && (
                <Button
                  onClick={() => {
                    setMessage("");
                    setEditor(query.data);
                  }}
                >
                  Edit contact
                </Button>
              )}
            </div>
          </header>
          <div className="contact-detail-columns">
            <section aria-labelledby="contact-information">
              <h3 id="contact-information">Contact information</h3>
              <dl>
                <dt>Email</dt>
                <dd>
                  {query.data.data.email ? (
                    <a href={`mailto:${query.data.data.email}`}>
                      {query.data.data.email}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
                <dt>Phone</dt>
                <dd>
                  {query.data.data.phone ? (
                    <a
                      href={`tel:${query.data.data.phone.replace(/[^+\d]/g, "")}`}
                    >
                      {query.data.data.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </dl>
            </section>
            <section aria-labelledby="contact-organization">
              <h3 id="contact-organization">Organization and tags</h3>
              <dl>
                <dt>Company</dt>
                <dd>{query.data.data.company || "—"}</dd>
                <dt>Tags</dt>
                <dd>{query.data.data.tags.join(", ") || "No tags added"}</dd>
              </dl>
            </section>
          </div>
          <section aria-labelledby="contact-billing-details">
            <h3 id="contact-billing-details">Billing details</h3>
            <dl>
              <dt>Legal / billing name</dt>
              <dd>
                {query.data.data.legalName || "Uses company or contact name"}
              </dd>
              <dt>Billing address</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>
                {query.data.data.billingAddress || "No billing address added"}
              </dd>
            </dl>
          </section>
          <section
            className="contact-notes"
            aria-labelledby="contact-notes-heading"
          >
            <h3 id="contact-notes-heading">Private notes</h3>
            <p>{query.data.data.notes || "No notes added yet."}</p>
            <p className="hint">Visible to team members with contact access.</p>
          </section>
        </>
      )}
      {editor && permissions.includes("contacts:write") && !query.isError && (
        <ContactEditor
          initial={editor}
          onClose={() => setEditor(null)}
          onForbidden={refreshAccess}
          onSaved={() => {
            setEditor(null);
            setMessage("Contact saved.");
            void cache.invalidateQueries({ queryKey: ["owner", "contacts"] });
            void query.refetch();
          }}
        />
      )}
    </div>
  );
}
