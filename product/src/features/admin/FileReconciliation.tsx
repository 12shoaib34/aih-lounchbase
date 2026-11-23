import { FormFeedback } from "@/components/ui/FormFeedback";
import { PageLoading } from "@/components/ui/PageLoading";
import { FileScanHistory } from "./FileScanHistory";
import { useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import {
  fileIntegritySchema,
  storageObjectsSchema,
  type ManagedFile,
} from "../../../shared/files";

export function FileReconciliation({
  userId,
  onRestore,
  canRestore = true,
}: {
  userId: string;
  onRestore: (file: ManagedFile) => void;
  canRestore?: boolean;
}) {
  const [integrity, setIntegrity] = useState<z.infer<
    typeof fileIntegritySchema
  > | null>(null);
  const [objects, setObjects] = useState<z.infer<
    typeof storageObjectsSchema
  > | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function check(kind: "files" | "objects", next = false) {
    if (pending) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      if (kind === "files") {
        const cursor = next ? integrity?.next : null;
        setIntegrity(
          await apiRequest(
            `/files/integrity${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`,
            { method: "POST" },
            fileIntegritySchema,
          ),
        );
      } else {
        const cursor = next ? objects?.next : null;
        setObjects(
          await apiRequest(
            `/files/objects${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
            { method: "POST" },
            storageObjectsSchema,
          ),
        );
      }
      setMessage("Observation batch saved. Review the findings below.");
      setHistoryRevision((value) => value + 1);
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "The check failed. Retry the same batch.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="component-card" aria-labelledby="storage-review-title">
      <h2 id="storage-review-title">Storage review</h2>
      <p>
        Checks leave files untouched and save one observation batch at a time.
        Changes during a scan can affect results. An unreferenced object may be
        an upload still in progress; ask the operator to investigate before
        removing anything.
      </p>
      <div className="public-actions">
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => void check("files")}
        >
          Check recorded files
        </Button>
        <Button
          disabled={pending}
          variant="secondary"
          onClick={() => void check("objects")}
        >
          Review stored objects
        </Button>
      </div>
      {pending && <PageLoading label="Checking storage…" layout="inline" />}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} focus={false} />
      {integrity && (
        <>
          <p>
            File batch checked at{" "}
            {new Date(integrity.checkedAt).toLocaleString()}. Up to 5 records
            per batch.
          </p>
          <DataTable
            caption="Recorded file integrity"
            rows={integrity.items}
            rowKey={(row) => row.id}
            empty="No recorded files in this batch."
            columns={[
              { key: "name", label: "File", render: (row) => row.name },
              { key: "state", label: "Integrity", render: (row) => row.state },
              {
                key: "action",
                label: "Recovery",
                render: (row) =>
                  ["missing", "damaged"].includes(row.state) ? (
                    canRestore ? (
                      <Button
                        variant="secondary"
                        disabled={pending}
                        aria-label={`Recover ${row.name}`}
                        onClick={() => onRestore(row)}
                      >
                        Recover
                      </Button>
                    ) : (
                      "Ask a staff member with restore permission"
                    )
                  ) : row.state === "unavailable" ? (
                    "Check failed; retry before recovering"
                  ) : (
                    "No repair needed"
                  ),
              },
            ]}
          />
          {integrity.next ? (
            <Button
              disabled={pending}
              onClick={() => void check("files", true)}
            >
              Check next file batch
            </Button>
          ) : (
            <p>End of recorded-file scan. Earlier batches are not shown.</p>
          )}
        </>
      )}
      {objects && (
        <>
          <p>
            Object batch checked at{" "}
            {new Date(objects.checkedAt).toLocaleString()}. Up to 100 objects
            per batch. “Referenced” does not verify file contents; use the
            recorded-file check for that.
          </p>
          <DataTable
            caption="Stored object references"
            rows={objects.items}
            rowKey={(row) => row.key}
            empty="No stored objects in this batch."
            columns={[
              {
                key: "key",
                label: "Object reference",
                render: (row) => row.key,
              },
              {
                key: "size",
                label: "Size",
                render: (row) => `${row.size} bytes`,
              },
              { key: "state", label: "Reference", render: (row) => row.state },
            ]}
          />
          {objects.next ? (
            <Button
              disabled={pending}
              onClick={() => void check("objects", true)}
            >
              Review next object batch
            </Button>
          ) : (
            <p>End of stored-object scan. Earlier batches are not shown.</p>
          )}
          <p>
            Unrecognized keys may belong to another feature. This screen does
            not delete objects.
          </p>
        </>
      )}
      <Button
        variant="secondary"
        aria-expanded={showHistory}
        onClick={() => setShowHistory((value) => !value)}
      >
        {showHistory ? "Hide scan history" : "View saved scan history"}
      </Button>
      {showHistory && (
        <FileScanHistory userId={userId} revision={historyRevision} />
      )}
    </section>
  );
}
