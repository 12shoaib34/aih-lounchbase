"use client";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { LoadingTable } from "@/components/ui/LoadingContent";
import type { Permission } from "../../../shared/access";
import { FileRecovery } from "./FileRecovery";
import { FileReconciliation } from "./FileReconciliation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OwnerPage } from "@/components/layouts/OwnerPage";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { DataTable } from "@/components/ui/DataTable";
import { apiRequest, ApiError } from "@/api/client";
import {
  fileSchema,
  filesSchema,
  fileTypes,
  maxFileSize,
  type ManagedFile,
} from "../../../shared/files";

export function FilesPage() {
  return (
    <OwnerPage title="Files" permission="files:read">
      {(userId, permissions) => (
        <Files
          key={permissions.join(",")}
          userId={userId}
          permissions={permissions}
        />
      )}
    </OwnerPage>
  );
}
function Files({
  userId,
  permissions,
}: {
  userId: string;
  permissions: Permission[];
}) {
  const confirmation = useConfirmation();
  const canWrite = permissions.includes("files:write");
  const canDownload = permissions.includes("files:download");
  const canDelete = permissions.includes("files:delete");
  const canReview = permissions.includes("files:review");
  const [recovery, setRecovery] = useState<ManagedFile | null>(null);
  const [reviewVersion, setReviewVersion] = useState(0);
  const [page, setPage] = useState(1);
  const [upload, setUpload] = useState<{ id: string; file: File } | null>(null);
  const [pending, setPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const query = useQuery({
    queryKey: ["owner", "files", userId, page],
    queryFn: ({ signal }) =>
      apiRequest(`/files?page=${page}`, { signal }, filesSchema),
    retry: false,
  });
  return (
    <>
      <p className="lede">
        Private business files. PNG, JPEG and PDF files up to 5 MiB. Downloads
        are attachments; files are not published on the website.
      </p>
      {query.data && (
        <p aria-label="Managed storage usage">
          Managed storage: {query.data.storage.usedBytes.toLocaleString()} bytes
          /{" "}
          {query.data.storage.maxBytes?.toLocaleString() ??
            "no configured byte limit"}
          ; {query.data.storage.usedCount.toLocaleString()} files /{" "}
          {query.data.storage.maxCount?.toLocaleString() ??
            "no configured file limit"}
          . Orphaned objects and provider overhead are not included.
        </p>
      )}
      {canWrite && (
        <form
          className="component-card"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!upload || pending) return;
            setError("");
            setMessage("");
            if (
              !fileTypes.includes(
                upload.file.type as (typeof fileTypes)[number],
              ) ||
              !upload.file.size ||
              upload.file.size > maxFileSize
            ) {
              setError(
                "Select a PNG, JPEG or PDF file between 1 byte and 5 MiB.",
              );
              return;
            }
            setPending(true);
            try {
              await apiRequest(
                `/files/${upload.id}`,
                {
                  method: "PUT",
                  headers: {
                    "Content-Type": upload.file.type,
                    "X-File-Name": encodeURIComponent(upload.file.name),
                  },
                  body: upload.file,
                },
                fileSchema,
              );
              setUpload(null);
              setMessage("File uploaded.");
              await query.refetch();
            } catch (failure) {
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Upload failed. Retry with the same file.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field
            key={upload?.id ?? "empty"}
            label="Choose file"
            type="file"
            accept={fileTypes.join(",")}
            disabled={pending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              setUpload(file ? { id: crypto.randomUUID(), file } : null);
            }}
          />
          <p>{upload?.file.name}</p>
          <Button type="submit" disabled={pending || !upload}>
            {pending && !deletingId ? "Uploading…" : "Upload file"}
          </Button>
        </form>
      )}
      {canWrite && recovery && (
        <FileRecovery
          key={recovery.id}
          target={recovery}
          onClose={() => setRecovery(null)}
          onRestored={() => {
            setRecovery(null);
            setMessage("Original file content restored.");
            setError("");
            setReviewVersion((value) => value + 1);
            void query.refetch();
          }}
        />
      )}
      {canReview && (
        <FileReconciliation
          userId={userId}
          key={reviewVersion}
          onRestore={setRecovery}
          canRestore={canWrite}
        />
      )}
      <FormFeedback message={error} error focus={false} />
      <FormFeedback message={message} focus={false} />
      {query.isPending ? (
        <LoadingTable
          label="Loading files…"
          columns={["File", "Size", "Actions"]}
          pagination
        />
      ) : query.isError ? (
        <>
          <p role="alert">
            {query.error instanceof ApiError
              ? query.error.message
              : "Files could not be loaded."}
          </p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </>
      ) : (
        <>
          <DataTable
            caption="Private files"
            rows={query.data.items}
            rowKey={(row) => row.id}
            empty="No files uploaded yet."
            columns={[
              { key: "name", label: "File", render: (row) => row.name },
              {
                key: "size",
                label: "Size",
                render: (row) => `${Math.ceil(row.size / 1024)} KiB`,
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="file-actions">
                    {canDownload && (
                      <a
                        href={`/api/files/${row.id}`}
                        aria-label={`Download ${row.name}`}
                      >
                        Download
                      </a>
                    )}
                    {canWrite && (
                      <Button
                        variant="secondary"
                        aria-label={`Restore ${row.name}`}
                        disabled={pending}
                        onClick={() => {
                          setRecovery(row);
                          setMessage("");
                          setError("");
                        }}
                      >
                        Restore
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="secondary"
                        aria-label={`Delete ${row.name}`}
                        disabled={pending}
                        onClick={async () => {
                          if (
                            !(await confirmation.confirm(
                              `Permanently delete ${row.name}?`,
                              {
                                title: "Delete file permanently?",
                                confirmLabel: "Delete file",
                              },
                            ))
                          )
                            return;
                          setPending(true);
                          setDeletingId(row.id);
                          setError("");
                          setMessage("");
                          try {
                            await apiRequest(`/files/${row.id}`, {
                              method: "DELETE",
                            });
                            setMessage("File deleted.");
                            await query.refetch();
                          } catch {
                            setError(
                              "Could not delete the file. Retry or contact the operator.",
                            );
                          } finally {
                            setPending(false);
                            setDeletingId(null);
                          }
                        }}
                      >
                        {deletingId === row.id ? "Deleting…" : "Delete"}
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination
            label="File pages"
            page={page}
            pageSize={20}
            total={query.data.total}
            disabled={query.isFetching || pending}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
