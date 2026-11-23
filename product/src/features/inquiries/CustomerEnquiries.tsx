"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Link } from "@/navigation";
import { authClient } from "@/lib/auth";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { enquirySummary } from "../../../shared/enquiries";
import Tracking from "../../../../src/app/app/track/tracking";

const response = z.object({
  items: z.array(enquirySummary),
  more: z.boolean(),
});
export default function CustomerEnquiries() {
  const user = authClient.useSession().data?.user;
  const reference = useSearchParams().has("reference");
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ["my-enquiries", user?.id, page],
    enabled: !!user,
    queryFn: ({ signal }) =>
      apiRequest("/inquiries/mine?page=" + page, { signal }, response),
  });
  return (
    <section className="component-card">
      <h1>My enquiries</h1>
      <p>
        <Link to="/inquire">Send an inquiry</Link>
      </p>
      {(!user || reference) && <Tracking />}
      {user && (
        <>
          <Button onClick={() => void list.refetch()}>Refresh enquiries</Button>
          {list.isPending ? (
            <p role="status">Loading enquiries…</p>
          ) : list.isError ? (
            <p role="alert">Could not load your enquiries. Try refreshing.</p>
          ) : (
            <>
              {list.data.items.length === 0 && (
                <p>
                  No enquiries on this page for your verified email address.
                </p>
              )}
              {list.data.items.map((item) => (
                <article className="component-card" key={item.id}>
                  <h2>{item.service}</h2>
                  <p>{item.status}</p>
                  <p>Reference: {item.id}</p>
                  <p>Received {new Date(item.received).toLocaleDateString()}</p>
                </article>
              ))}
              {(page > 1 || list.data.more) && (
                <nav aria-label="Enquiry pages">
                  <Button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </Button>{" "}
                  Page {page}{" "}
                  <Button
                    disabled={!list.data.more}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </Button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
