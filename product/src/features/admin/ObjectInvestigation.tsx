import { useFeedbackNotice } from "@/components/ui/useFeedbackNotice";
import { preservationSchema } from "../../../shared/file-preservation";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { objectInvestigationSchema } from "../../../shared/files";

export function ObjectInvestigation({
  canPreserve,
  scanId,
  reference,
}: {
  canPreserve: boolean;
  scanId: string;
  reference: string;
}) {
  const [result, setResult] = useState<z.infer<
    typeof objectInvestigationSchema
  > | null>(null);
  const [exportMessage, setExportMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const feedback = useRef<HTMLParagraphElement>(null);
  useFeedbackNotice(error || exportMessage, !!error, feedback);
  useEffect(() => {
    if (result || error || exportMessage) feedback.current?.focus();
  }, [result, error, exportMessage]);
  return (
    <div>
      <Button
        variant="secondary"
        disabled={pending}
        aria-label={`Recheck object ${reference}`}
        onClick={async () => {
          if (pending) return;
          setPending(true);
          setResult(null);
          setExportMessage("");
          setError("");
          try {
            setResult(
              await apiRequest(
                `/files/history/${scanId}/objects/${reference}/check`,
                { method: "POST" },
                objectInvestigationSchema,
              ),
            );
          } catch (failure) {
            setError(
              failure instanceof ApiError
                ? failure.message
                : "The check failed. Try again.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Checking…" : "Recheck current reference"}
      </Button>
      {canPreserve && result?.state === "unreferenced" && (
        <>
          <p>
            Download a private plaintext bundle of the current bytes (up to 5
            MiB). Store it securely and verify it separately; a download does
            not prove durable preservation.
          </p>
          <Button
            variant="secondary"
            disabled={pending}
            aria-label={`Preserve object ${reference}`}
            onClick={async () => {
              if (pending) return;
              setPending(true);
              setError("");
              setExportMessage("");
              try {
                const bundle = await apiRequest(
                  `/files/history/${scanId}/objects/${reference}/preserve`,
                  { method: "POST" },
                  preservationSchema,
                );
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(bundle)], {
                    type: "application/json",
                  }),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = `orphan-${reference}.json`;
                document.body.append(link);
                link.click();
                link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                setExportMessage(
                  "Bundle download requested. Verify the saved file and store it securely. The object was not deleted; cleanup is not approved.",
                );
              } catch (failure) {
                setError(
                  failure instanceof ApiError
                    ? failure.message
                    : "Export failed. Retry or contact the operator.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Preparing…" : "Download preservation bundle"}
          </Button>
        </>
      )}
      {(result || error || exportMessage) && (
        <p
          className={`form-feedback${error || result?.state === "unavailable" ? " form-feedback-error" : ""}`}
          ref={feedback}
          tabIndex={-1}
          role={error || result?.state === "unavailable" ? "alert" : "status"}
        >
          {error ||
            exportMessage ||
            (result && (
              <>
                Checked {new Date(result.checkedAt).toLocaleString()}:{" "}
                {result.state === "referenced"
                  ? "A managed record now exists. Use the recorded-file integrity check to verify its content."
                  : result.state === "absent"
                    ? "No object was found at this key."
                    : result.state === "unavailable"
                      ? "Storage could not be checked. This does not establish that the object is absent."
                      : `Still unreferenced; storage reports ${result.size} bytes. Preserve the object and investigate with the operator.`}{" "}
                This result is not saved and can become stale. It does not
                authorize deletion.
              </>
            ))}
        </p>
      )}
    </div>
  );
}
