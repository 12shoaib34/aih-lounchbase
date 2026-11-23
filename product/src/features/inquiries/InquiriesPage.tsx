"use client";
import { useEffect, useState } from "react";
import { Link } from "@/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Pagination } from "@/components/ui/Pagination";
import { SelectField } from "@/components/ui/SelectField";
import { apiRequest, ApiError } from "@/api/client";
import { hasPermission, type Permission } from "../../../shared/access";
import { inquiryPageSchema } from "../../../shared/inquiries";

export default function InquiriesPage() {
  return (
    <OwnerPage title="Inquiries" permission="inquiries:manage">
      {(userId, permissions) => (
        <Inbox
          key={userId + permissions.join(",")}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}

function Inbox({
  userId,
  permissions,
}: {
  userId: string;
  permissions: Permission[];
}) {
  const cache = useQueryClient();
  const [status, setStatus] = useState("new");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState("");
  const [feedback, setFeedback] = useState({ message: "", error: false });
  const query = useQuery({
    queryKey: ["owner", "inquiries", userId, status, page],
    queryFn: ({ signal }) =>
      apiRequest(
        `/inquiries?status=${status}&page=${page}`,
        { signal },
        inquiryPageSchema,
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
  async function act(id: string, action: "handle" | "convert") {
    setPending(id);
    setFeedback({ message: "", error: false });
    try {
      await apiRequest(
        `/inquiries/${id}/${action}`,
        { method: "POST" },
        z.object({ contactId: z.uuid().nullable() }),
      );
      if (status === "new" && page > 1 && query.data?.items.length === 1)
        setPage(page - 1);
      await cache.invalidateQueries({ queryKey: ["owner", "inquiries"] });
      if (action === "convert")
        await cache.invalidateQueries({ queryKey: ["owner", "contacts"] });
      setFeedback({
        message:
          action === "convert"
            ? "Contact created. The inquiry is in Handled."
            : "Inquiry marked handled.",
        error: false,
      });
    } catch (failure) {
      setFeedback({
        message:
          failure instanceof Error
            ? failure.message
            : "Could not update the inquiry. Try again.",
        error: true,
      });
      if (failure instanceof ApiError && [401, 403].includes(failure.status))
        void cache.invalidateQueries({ queryKey: ["owner", "access"] });
    } finally {
      setPending("");
    }
  }
  return (
    <div className="inquiry-inbox">
      <SelectField
        label="Inquiry status"
        value={status}
        disabled={!!pending}
        onChange={(e) => {
          setStatus(e.target.value);
          setPage(1);
          setFeedback({ message: "", error: false });
        }}
      >
        <option value="new">New</option>
        <option value="handled">Handled</option>
      </SelectField>
      <FormFeedback message={feedback.message} error={feedback.error} />
      {query.isPending ? (
        <p role="status">Loading inquiries…</p>
      ) : query.isError ? (
        <div role="alert">
          Could not load inquiries.{" "}
          <Button onClick={() => void query.refetch()}>Retry</Button>
        </div>
      ) : (
        <>
          {!query.data.items.length && (
            <p className="portal-empty">No {status} inquiries on this page.</p>
          )}
          {query.data.items.map((item) => (
            <details key={item.id} className="component-card">
              <summary>
                <strong>{item.name}</strong> · {item.email}
              </summary>
              <p>Received {new Date(item.createdAt).toLocaleString()}</p>
              {item.phone && <p>Phone: {item.phone}</p>}
              <dl>
                {item.answers
                  .filter((a) => a.value)
                  .map((a) => (
                    <div key={a.key}>
                      <dt>{a.label}</dt>
                      <dd>{a.value}</dd>
                    </div>
                  ))}
              </dl>
              <div className="account-actions">
                {status === "new" && (
                  <Button
                    disabled={!!pending}
                    variant="secondary"
                    onClick={() => void act(item.id, "handle")}
                  >
                    Mark handled
                  </Button>
                )}
                {item.contactId
                  ? hasPermission(permissions, "contacts:read") && (
                      <Link to={"/admin/contacts/" + item.contactId}>
                        View contact
                      </Link>
                    )
                  : hasPermission(permissions, "contacts:write") && (
                      <Button
                        disabled={!!pending}
                        onClick={() => void act(item.id, "convert")}
                      >
                        Create contact
                      </Button>
                    )}
                {pending === item.id && <span role="status">Saving…</span>}
              </div>
            </details>
          ))}
          {(query.data.total > 20 || page > 1) && (
            <Pagination
              page={page}
              pageSize={20}
              total={query.data.total}
              onPageChange={setPage}
              disabled={!!pending}
              label="Inquiry pages"
            />
          )}
        </>
      )}
    </div>
  );
}
