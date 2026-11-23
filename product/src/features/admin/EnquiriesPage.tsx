"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { apiRequest } from "@/api/client";
import { enquiryStatus, inboxResponse } from "../../../shared/enquiries";
import type { z } from "zod";

function Inbox({ userId }: { userId: string }) {
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const query = useQuery({
    queryKey: ["owner", "enquiries", userId, page],
    queryFn: ({ signal }) =>
      apiRequest("/admin/enquiries?page=" + page, { signal }, inboxResponse),
  });
  async function update(
    row: z.infer<typeof inboxResponse>["items"][number],
    status: string,
  ) {
    setBusy(true);
    setNotice("");
    try {
      await apiRequest("/admin/enquiries/" + row.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, version: row.version }),
      });
      setNotice("Status saved.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Update failed.");
    } finally {
      await query.refetch();
      setBusy(false);
    }
  }
  return (
    <section className="component-card">
      <Button onClick={() => void query.refetch()}>Refresh enquiries</Button>
      <p role="status">{notice}</p>
      {query.isError ? (
        <p role="alert">Could not load enquiries. Try refreshing.</p>
      ) : query.isPending ? (
        <p>Loading enquiries…</p>
      ) : (
        <>
          {!query.data.items.length && <p>No enquiries on this page.</p>}
          {query.data.items.map((row) => (
            <details key={row.id} className="component-card">
              <summary>
                {row.payload.name} · {row.service} · {row.status}
              </summary>
              <dl>
                <dt>Reference</dt>
                <dd>{row.id}</dd>
                <dt>Received</dt>
                <dd>{new Date(row.received).toLocaleString()}</dd>
                {Object.entries(row.payload)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k.replace(/([A-Z])/g, " $1")}</dt>
                      <dd
                        style={{
                          whiteSpace: "pre-wrap",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {String(v)}
                      </dd>
                    </div>
                  ))}
              </dl>
              <label>
                Enquiry status{" "}
                <select
                  disabled={busy}
                  value={row.status}
                  onChange={(e) => void update(row, e.target.value)}
                >
                  {enquiryStatus.options.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
            </details>
          ))}
          {(page > 1 || query.data.more) && (
            <nav aria-label="Enquiry pages">
              <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>{" "}
              Page {page}{" "}
              <Button
                disabled={!query.data.more}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
export default function EnquiriesPage() {
  return (
    <OwnerPage title="Enquiries">
      {(userId) => <Inbox userId={userId} />}
    </OwnerPage>
  );
}
