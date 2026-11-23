import { FormFeedback } from "@/components/ui/FormFeedback";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker } from "@/navigation";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Dialog } from "@/components/ui/Dialog";
import {
  recordFields,
  recordSchema,
  type RecordItem,
} from "../../../shared/records";

export function RecordEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: RecordItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const confirmation = useConfirmation();
  const formRef = useRef<HTMLFormElement>(null);
  const [base, setBase] = useState(initial);
  const [creationId] = useState(() => crypto.randomUUID());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState<"active" | "archived">(
    initial?.status ?? "active",
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (Object.keys(fields).length)
      formRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [fields]);
  const [conflict, setConflict] = useState(false);
  const [discard, setDiscard] = useState(false);
  const dirty =
    title !== (base?.title ?? "") || status !== (base?.status ?? "active");
  const blocker = useBlocker(dirty || pending);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, pending]);
  function close() {
    if (pending) return;
    if (dirty) setDiscard(true);
    else onClose();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || conflict) return;
    setError("");
    setFields({});
    const parsed = recordFields.safeParse({ title, status });
    if (!parsed.success) {
      const next: Record<string, string[]> = {};
      for (const issue of parsed.error.issues)
        next[String(issue.path[0])] = [issue.message];
      setFields(next);
      return;
    }
    setPending(true);
    try {
      await apiRequest(
        base ? `/records/${base.id}` : "/records",
        {
          method: base ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parsed.data,
            ...(base ? { version: base.version } : { id: creationId }),
          }),
        },
        recordSchema,
      );
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "We could not confirm the save. Retry the same details or check your records before starting another creation.",
      );
      if (failure instanceof ApiError) {
        setFields(failure.fields);
        setConflict(failure.status === 409);
      }
    } finally {
      setPending(false);
    }
  }
  async function reload() {
    if (!base || pending) return;
    if (
      dirty &&
      !(await confirmation.confirm(
        "Replace your draft with the latest saved record?",
        { title: "Reload record?", confirmLabel: "Discard and reload" },
      ))
    )
      return;
    setPending(true);
    try {
      const latest = await apiRequest(`/records/${base.id}`, {}, recordSchema);
      setBase(latest);
      setTitle(latest.title);
      setStatus(latest.status);
      setConflict(false);
      setError("");
      setFields({});
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.message
          : "The latest record could not be loaded.",
      );
    } finally {
      setPending(false);
    }
  }
  const leaving = blocker.state === "blocked";
  return (
    <Dialog
      open
      actions={null}
      onClose={close}
      title={initial ? "Edit record" : "Create record"}
    >
      {discard || leaving ? (
        <div className="discard-prompt">
          <p role="alert">
            {pending
              ? "A save is in progress. Wait for it to finish before leaving."
              : "Discard your unsaved changes?"}
          </p>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => {
                if (leaving) blocker.proceed();
                else onClose();
              }}
            >
              Discard changes
            </Button>
            <Button
              onClick={() => {
                setDiscard(false);
                if (leaving) blocker.reset();
              }}
            >
              Keep editing
            </Button>
          </div>
        </div>
      ) : (
        <>
          <form ref={formRef} onSubmit={submit} noValidate>
            <Field
              label="Record title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              error={fields.title?.[0]}
              disabled={pending}
            />
            <SelectField
              label="Record status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as "active" | "archived")
              }
              error={fields.status?.[0]}
              disabled={pending}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </SelectField>
            <FormFeedback message={error} error focus={false} />
            <div className="dialog-actions">
              <Button variant="secondary" disabled={pending} onClick={close}>
                Close
              </Button>
              <Button type="submit" disabled={pending || conflict}>
                {pending ? "Saving…" : "Save record"}
              </Button>
            </div>
          </form>
          {conflict && base && (
            <Button disabled={pending} onClick={() => void reload()}>
              Load latest record
            </Button>
          )}
          {conflict && !base && (
            <p>
              Close this draft and check the list before creating another
              record.
            </p>
          )}
        </>
      )}
    </Dialog>
  );
}
