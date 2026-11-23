import { ObjectInvestigation } from "./ObjectInvestigation";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { fileScanHistorySchema } from "../../../shared/files";

export function FileScanHistory({
  revision,
  userId,
}: {
  revision: number;
  userId: string;
}) {
  const query = useQuery({
    queryKey: ["owner", "file-scan-history", userId, revision],
    queryFn: ({ signal }) =>
      apiRequest("/files/history", { signal }, fileScanHistorySchema),
    retry: false,
    gcTime: 0,
  });
  return (
    <section aria-labelledby="scan-history-title">
      <h3 id="scan-history-title">Recent scan batches</h3>
      <p>
        The latest 50 saved batches are retained across reviewers. These are
        past observations, not current health or a consistent full scan. Older
        batches are replaced. Filenames and unrecognized object keys are not
        retained.
      </p>
      <Button
        variant="secondary"
        disabled={query.isFetching}
        onClick={() => void query.refetch()}
      >
        Refresh scan history
      </Button>
      {query.isPending ? (
        <p>Loading scan history…</p>
      ) : query.isError ? (
        <p role="alert">
          {query.error instanceof ApiError
            ? query.error.message
            : "Scan history could not be loaded. Try refreshing."}
        </p>
      ) : (
        <div role="region" aria-label="Saved storage observations">
          {!query.data.items.length ? (
            <p>No saved scan batches yet.</p>
          ) : (
            <ol className="scan-history">
              {query.data.items.map((row) => (
                <li key={row.id}>
                  <details>
                    <summary>
                      {row.kind === "integrity"
                        ? "File integrity"
                        : "Object references"}{" "}
                      — {new Date(row.finishedAt).toLocaleString()} —{" "}
                      {row.items.length} observations
                    </summary>
                    <p>
                      Started {new Date(row.startedAt).toLocaleString()}.{" "}
                      {row.continued ? "Continuation batch" : "First batch"};{" "}
                      {row.hasMore ? "more remain" : "end reached"}.
                    </p>
                    <p>Reviewer reference: {row.actorId}</p>
                    {row.items.length ? (
                      <ul>
                        {row.items.map((item, index) => (
                          <li key={index}>
                            {item.reference ??
                              "Unrecognized key (not retained)"}
                            : {item.state}, {item.size} bytes
                            {row.kind === "objects" &&
                              item.state === "unreferenced" &&
                              item.reference && (
                                <ObjectInvestigation
                                  canPreserve={query.data.canPreserve}
                                  scanId={row.id}
                                  reference={item.reference}
                                />
                              )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No items in this batch.</p>
                    )}
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
