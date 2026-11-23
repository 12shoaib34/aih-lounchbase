import { FormFeedback } from "@/components/ui/FormFeedback";
import { useState } from "react";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  fileSchema,
  maxFileSize,
  type ManagedFile,
} from "../../../shared/files";

export function FileRecovery({
  target,
  onClose,
  onRestored,
}: {
  target: ManagedFile;
  onClose: () => void;
  onRestored: () => void;
}) {
  const [original, setOriginal] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="component-card"
      aria-label="Restore original file"
      onSubmit={async (event) => {
        event.preventDefault();
        if (pending || !original) return;
        setError("");
        if (original.size !== target.size || original.size > maxFileSize) {
          setError(
            "Select the original file. Its size must match the stored record.",
          );
          return;
        }
        setPending(true);
        try {
          await apiRequest(
            `/files/${target.id}/restore`,
            {
              method: "PUT",
              headers: {
                "Content-Type": target.type,
                "X-File-Name": encodeURIComponent(target.name),
              },
              body: original,
            },
            fileSchema,
          );
          onRestored();
        } catch (failure) {
          setError(
            failure instanceof ApiError
              ? failure.message
              : "Restoration failed. Retry with the same original file.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <h2>Restore {target.name}</h2>
      <p>
        Select the original file from your device. Its contents must match the
        recorded checksum. The stored filename is preserved, even if your local
        copy has been renamed. This cannot recover a file without the original
        bytes.
      </p>
      <Field
        autoFocus
        label="Original file for recovery"
        type="file"
        required
        disabled={pending}
        onChange={(event) => setOriginal(event.target.files?.[0] ?? null)}
      />
      <FormFeedback message={error} error focus={false} />
      <div className="public-actions">
        <Button type="submit" disabled={pending || !original}>
          {pending ? "Restoring…" : "Restore original content"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={onClose}
        >
          Cancel recovery
        </Button>
      </div>
    </form>
  );
}
