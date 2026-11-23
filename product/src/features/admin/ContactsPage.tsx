"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Pagination } from "@/components/ui/Pagination";
import { pageDescriptions } from "@/app/pageMetadata";
import { ContactsSkeleton, ContactResultsSkeleton } from "./ContactsSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import type { Permission } from "../../../shared/access";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "@/navigation";
import { ContactImport } from "./ContactImport";
import { ContactEditor } from "./ContactEditor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { apiRequest, ApiError } from "@/api/client";
import {
  contactsPageSchema,
  contactListQuery,
  type Contact,
} from "../../../shared/contacts";

export function ContactsPage() {
  return (
    <OwnerPage
      contentHeader
      title="Contacts"
      permission="contacts:read"
      loading={<ContactsSkeleton />}
    >
      {(userId, permissions) => (
        <Contacts
          key={userId + ":" + [...permissions].sort().join(",")}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}
function Contacts({
  userId,
  permissions,
}: {
  userId: string;
  permissions: Permission[];
}) {
  const cache = useQueryClient();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const parsed = contactListQuery.safeParse(Object.fromEntries(params));
  const { search, page, status } = parsed.success
    ? parsed.data
    : contactListQuery.parse({});
  const canWrite = permissions.includes("contacts:write");
  const canImport = permissions.includes("contacts:import");
  const canExport = permissions.includes("contacts:export");
  const refreshAccess = () =>
    void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState<Contact | "new" | null>(null);
  const [searchDraft, setSearchDraft] = useState<{
    key: string;
    value: string;
  } | null>(null);
  const query = useQuery({
    queryKey: ["owner", "contacts", userId, search, page, status],
    enabled: parsed.success,
    queryFn: ({ signal }) =>
      apiRequest(
        "/contacts?" +
          new URLSearchParams({ search, page: String(page), status }),
        { signal },
        contactsPageSchema,
      ),
    retry: false,
  });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      [401, 403].includes(query.error.status)
    )
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  }, [query.error, cache]);
  function filter(
    changes: Partial<{ search: string; page: number; status: string }>,
  ) {
    setSearchDraft(null);
    // Router transitions may leave the previous render interactive briefly.
    // Merge rapid filter actions against the URL already shown by the browser.
    const current = contactListQuery.safeParse(
      Object.fromEntries(new URLSearchParams(window.location.search)),
    );
    const next = {
      ...(current.success ? current.data : { search, page, status }),
      ...changes,
    };
    const values = new URLSearchParams();
    if (next.search) values.set("search", next.search);
    if (next.status !== "active") values.set("status", next.status);
    if (next.page !== 1) values.set("page", String(next.page));
    setParams(values);
  }
  function resetFilters() {
    setSearchDraft(null);
    setParams(new URLSearchParams());
  }
  const detailUrl = (id: string) => "/admin/contacts/" + id + location.search;
  if (!parsed.success)
    return (
      <>
        <PageHeader
          title="Contacts"
          description={pageDescriptions["Contacts"]}
        />
        <section className="portal-empty">
          <p role="alert">
            These contact filters are invalid. Reset them to view contacts.
          </p>
          <Button onClick={resetFilters}>Reset filters</Button>
        </section>
      </>
    );
  return (
    <div className="contacts-page">
      <PageHeader
        title="Contacts"
        description={pageDescriptions["Contacts"]}
        actions={
          canWrite && (
            <Button
              onClick={() => {
                setMessage("");
                setEditor("new");
              }}
            >
              Add contact
            </Button>
          )
        }
      />
      <FormFeedback message={message} focus={false} />
      <div className="contacts-controls">
        <form
          className="directory-search"
          onSubmit={(event) => {
            event.preventDefault();
            filter({
              search: String(
                new FormData(event.currentTarget).get("search") ?? "",
              ).trim(),
              page: 1,
            });
          }}
        >
          <Field
            label="Search contacts"
            placeholder="Name, company, email or phone"
            name="search"
            type="search"
            maxLength={100}
            value={
              searchDraft?.key === location.key ? searchDraft.value : search
            }
            onChange={(event) =>
              setSearchDraft({ key: location.key, value: event.target.value })
            }
          />
          <Button type="submit" variant="secondary">
            Search contacts
          </Button>
        </form>
        <div className="contact-toolbar">
          <SelectField
            label="Contact status"
            value={status}
            onChange={(event) =>
              filter({ status: event.target.value, page: 1 })
            }
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All</option>
          </SelectField>
          <Button variant="secondary" onClick={resetFilters}>
            Reset filters
          </Button>
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => {
              refreshAccess();
              void query.refetch();
            }}
          >
            Refresh contacts
          </Button>
        </div>
      </div>
      {(canImport || canExport) && (
        <ContactImport
          canImport={canImport}
          canExport={canExport}
          onForbidden={refreshAccess}
          onImported={() => void query.refetch()}
        />
      )}
      {query.isPending ? (
        <ContactResultsSkeleton canWrite={canWrite} />
      ) : query.isError ? (
        <div className="portal-empty">
          <p role="alert">
            Contacts could not be loaded. Refresh to try again.
          </p>
          <Button
            onClick={() => {
              refreshAccess();
              void query.refetch();
            }}
          >
            Retry contacts
          </Button>
        </div>
      ) : (
        <>
          <p className="list-result-summary" role="status">
            {!query.data.items.length
              ? query.data.total + " contacts"
              : (page - 1) * 20 +
                1 +
                "–" +
                Math.min(page * 20, query.data.total) +
                " of " +
                query.data.total +
                " contacts"}
          </p>
          {query.data.items.length ? (
            <div className="contacts-table-wrap">
              <table className="data-table contacts-table" role="table">
                <caption className="sr-only">Business contacts</caption>
                <thead role="rowgroup">
                  <tr role="row">
                    <th scope="col">Name / email</th>
                    <th scope="col">Company</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {query.data.items.map((row) => (
                    <tr key={row.id} role="row">
                      <th scope="row" role="rowheader">
                        <Link to={detailUrl(row.id)}>{row.data.name}</Link>
                        <span className="contact-email">
                          {row.data.email || "No email added"}
                        </span>
                      </th>
                      <td role="cell" data-label="Company">
                        {row.data.company || "—"}
                      </td>
                      <td role="cell" data-label="Status">
                        <span
                          className={
                            "contact-status contact-status-" + row.data.status
                          }
                        >
                          {row.data.status === "active" ? "Active" : "Archived"}
                        </span>
                      </td>
                      <td role="cell" data-label="Actions">
                        {canWrite ? (
                          <Button
                            variant="secondary"
                            aria-label={"Edit " + row.data.name}
                            onClick={() => {
                              setMessage("");
                              setEditor(row);
                            }}
                          >
                            Edit
                          </Button>
                        ) : (
                          <Link
                            to={detailUrl(row.id)}
                            aria-label={"View " + row.data.name}
                          >
                            View →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className="portal-empty">
              <h2>
                {page > 1
                  ? "No contacts on this page"
                  : search || status !== "active"
                    ? "No matching contacts"
                    : "No active contacts yet"}
              </h2>
              <p>
                {page > 1
                  ? "The list may have changed. Return to the first page."
                  : search || status !== "active"
                    ? "Try a different search or reset the filters."
                    : "Add a contact or change the status filter to find archived records."}
              </p>
              {page > 1 && (
                <Button onClick={() => filter({ page: 1 })}>First page</Button>
              )}
            </section>
          )}
          <Pagination
            label="Contact pages"
            page={page}
            pageSize={20}
            total={query.data.total}
            disabled={query.isFetching}
            maxPage={10000}
            onPageChange={(page) => filter({ page })}
          />
        </>
      )}
      {editor && canWrite && (
        <ContactEditor
          initial={editor === "new" ? null : editor}
          onForbidden={refreshAccess}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setMessage(
              editor === "new" ? "Contact created." : "Contact saved.",
            );
            setEditor(null);
            void query.refetch();
          }}
        />
      )}
    </div>
  );
}
