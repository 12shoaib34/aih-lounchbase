import { FormFeedback } from "@/components/ui/FormFeedback";
import { RecordsSkeleton, RecordsResultsSkeleton } from "./WorkspaceSkeletons";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "@/navigation";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Pagination } from "@/components/ui/Pagination";
import { Dialog } from "@/components/ui/Dialog";
import { accessSchema } from "../../../shared/access";
import {
  listQuery,
  recordsPage,
  type RecordItem,
} from "../../../shared/records";
import { RecordEditor } from "./RecordEditor";

export function WorkspacePage() {
  const [locationParams] = useSearchParams();
  const cache = useQueryClient();
  const access = useQuery({
    queryKey: ["workspace", "access"],
    retry: false,
    staleTime: 0,
    queryFn: ({ signal }) => apiRequest("/access", { signal }, accessSchema),
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["workspace"] });
      cache.removeQueries({ queryKey: ["records"] });
    },
    [cache],
  );
  return (
    <>
      {access.isPending ? (
        <RecordsSkeleton />
      ) : access.isError ? (
        <section className="component-card access-message">
          <h1>My workspace</h1>
          <p role="alert">
            {access.error instanceof ApiError && access.error.status === 401
              ? "Sign in to open your workspace."
              : "Your workspace could not be opened. Please try again."}
          </p>
          <Link to="/account">Go to account access</Link>
          <Button onClick={() => void access.refetch()}>Try again</Button>
        </section>
      ) : (
        <Records
          key={`${access.data.userId}:${locationParams.toString()}`}
          userId={access.data.userId}
        />
      )}
    </>
  );
}
function Records({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const parsed = listQuery.safeParse(Object.fromEntries(params));
  const filter = parsed.success
    ? { ...parsed.data, scope: "own" as const }
    : listQuery.parse({});
  const queryString = new URLSearchParams(
    Object.entries(filter).map(([key, value]) => [key, String(value)]),
  ).toString();
  const [editor, setEditor] = useState<{ item: RecordItem | null } | null>(
    null,
  );
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const list = useQuery({
    queryKey: ["records", userId, queryString],
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest(`/records?${queryString}`, { signal }, recordsPage),
  });
  function change(next: Partial<typeof filter>) {
    setSelected({});
    setParams(
      new URLSearchParams(
        Object.entries({ ...filter, ...next }).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
    );
  }
  async function refresh() {
    setSelected({});
    await cache.invalidateQueries({ queryKey: ["records", userId] });
  }
  const count = Object.keys(selected).length;
  async function archive() {
    if (pending || !count) return;
    setPending(true);
    setError("");
    try {
      await apiRequest(
        "/records/archive",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: Object.entries(selected).map(([id, version]) => ({
              id,
              version,
            })),
          }),
        },
        z.object({ updated: z.number().int() }),
      );
      setConfirmArchive(false);
      setMessage(`${count} record${count === 1 ? "" : "s"} archived.`);
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "We could not confirm the archive. Refresh before trying again.",
      );
    } finally {
      setPending(false);
    }
  }
  const selectable =
    list.data?.items.filter((item) => item.status === "active") ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>My records</h1>
          <p className="lede">Create, organize, and manage your records.</p>
        </div>
        <Button
          onClick={() => {
            setMessage("");
            setEditor({ item: null });
          }}
        >
          Create record
        </Button>
      </div>
      <FormFeedback message={message} focus={false} />
      {!parsed.success && (
        <p role="alert">
          Those filters were invalid. Default filters are shown below.
        </p>
      )}
      <form
        className="record-filters"
        key={queryString}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          change({
            search: String(data.get("search") ?? "").trim(),
            status: data.get("status") as typeof filter.status,
            sort: data.get("sort") as typeof filter.sort,
            pageSize: Number(data.get("pageSize")),
            page: 1,
          });
        }}
      >
        <Field
          label="Search records"
          name="search"
          type="search"
          maxLength={100}
          defaultValue={filter.search}
          placeholder="Search by title"
        />
        <SelectField
          label="Filter by status"
          name="status"
          defaultValue={filter.status}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </SelectField>
        <SelectField
          label="Sort records"
          name="sort"
          defaultValue={filter.sort}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="title">Title A–Z</option>
        </SelectField>
        <SelectField
          label="Records per page"
          name="pageSize"
          defaultValue={filter.pageSize}
        >
          {![5, 10, 25, 50].includes(filter.pageSize) && (
            <option value={filter.pageSize}>{filter.pageSize}</option>
          )}
          <option value="5">5</option>
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </SelectField>
        <Button type="submit">Apply filters</Button>
        <Button
          variant="secondary"
          onClick={() =>
            change({
              search: "",
              status: "all",
              sort: "newest",
              pageSize: 10,
              page: 1,
            })
          }
        >
          Reset filters
        </Button>
      </form>
      {list.isPending ? (
        <RecordsResultsSkeleton />
      ) : list.isError ? (
        <div className="component-card">
          <h2>Records unavailable</h2>
          <p role="alert">
            {list.error instanceof ApiError
              ? list.error.message
              : "Your records could not be loaded."}
          </p>
          <Button onClick={() => void refresh()}>Reload records</Button>
          <Link to="/account">Check your account</Link>
        </div>
      ) : (
        <>
          <div className="record-toolbar">
            <p>
              {list.data.total} record{list.data.total === 1 ? "" : "s"} ·{" "}
              {count} selected
            </p>
            <Button
              disabled={!count || pending || list.isFetching}
              onClick={() => {
                setError("");
                setConfirmArchive(true);
              }}
            >
              Archive selected
            </Button>
            <Button
              variant="secondary"
              disabled={pending || list.isFetching}
              onClick={() => void refresh()}
            >
              Refresh records
            </Button>
          </div>
          {list.isFetching && <p role="status">Updating records…</p>}
          {list.data.items.length ? (
            <>
              <label className="select-page">
                <input
                  type="checkbox"
                  checked={
                    selectable.length > 0 &&
                    selectable.every((item) => selected[item.id] !== undefined)
                  }
                  disabled={!selectable.length || pending || list.isFetching}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? Object.fromEntries(
                            selectable.map((item) => [item.id, item.version]),
                          )
                        : {},
                    )
                  }
                />{" "}
                Select active records on this page
              </label>
              <div className="records-list">
                {list.data.items.map((item) => (
                  <article
                    className="record-row"
                    key={item.id}
                    aria-label={`Record ${item.title}`}
                  >
                    <label className="record-select">
                      <input
                        aria-label={`Select ${item.title}`}
                        type="checkbox"
                        disabled={
                          item.status !== "active" || pending || list.isFetching
                        }
                        checked={selected[item.id] !== undefined}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = { ...current };
                            if (event.target.checked)
                              next[item.id] = item.version;
                            else delete next[item.id];
                            return next;
                          })
                        }
                      />
                    </label>
                    <div className="record-details">
                      <h2>{item.title}</h2>
                      <p>Updated {new Date(item.updatedAt).toLocaleString()}</p>
                    </div>
                    <span
                      className={`record-status record-status-${item.status}`}
                    >
                      {item.status === "active" ? "Active" : "Archived"}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => setEditor({ item })}
                      disabled={pending || list.isFetching}
                      aria-label={`Edit ${item.title}`}
                    >
                      Edit
                    </Button>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <section className="component-card empty-records">
              <h2>
                {filter.search || filter.status !== "all"
                  ? "No matching records"
                  : filter.page > 1
                    ? "No records on this page"
                    : "No records yet"}
              </h2>
              <p>
                {filter.search || filter.status !== "all"
                  ? "Try a different search or reset your filters."
                  : filter.page > 1
                    ? "The list changed. Return to the first page."
                    : "Create your first record to get started."}
              </p>
              {filter.page > 1 && (
                <Button onClick={() => change({ page: 1 })}>
                  Go to first page
                </Button>
              )}
            </section>
          )}
          <Pagination
            page={filter.page}
            pageSize={filter.pageSize}
            total={list.data.total}
            disabled={pending || list.isFetching}
            onPageChange={(page) => change({ page })}
          />
        </>
      )}
      {editor && (
        <RecordEditor
          initial={editor.item}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setMessage(editor.item ? "Record updated." : "Record created.");
            void refresh();
          }}
        />
      )}
      <Dialog
        open={confirmArchive}
        onClose={() => {
          if (!pending) setConfirmArchive(false);
        }}
        title="Archive selected records"
        actions={
          <>
            {" "}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirmArchive(false)}
            >
              Close
            </Button>
            <Button
              disabled={pending || !count || !!error}
              onClick={() => void archive()}
            >
              {pending ? "Archiving…" : "Confirm archive"}
            </Button>
          </>
        }
      >
        <p>
          Archive {count} selected record{count === 1 ? "" : "s"}? You can
          restore each record by editing its status.
        </p>
        {error && (
          <div role="alert">
            <p>{error}</p>
            <Button
              disabled={pending}
              onClick={() => {
                setConfirmArchive(false);
                void refresh();
              }}
            >
              Refresh selection
            </Button>
          </div>
        )}
      </Dialog>
    </>
  );
}
