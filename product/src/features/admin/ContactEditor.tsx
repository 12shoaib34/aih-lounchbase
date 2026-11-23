import { FormFeedback } from "@/components/ui/FormFeedback";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { UnsavedChanges } from "@/components/ui/UnsavedChanges";
import { apiRequest, ApiError } from "@/api/client";
import {
  contactInput,
  contactSchema,
  type ContactInput,
  type Contact,
} from "../../../shared/contacts";

const defaults: ContactInput = {
  name: "",
  email: "",
  phone: "",
  company: "",
  legalName: "",
  billingAddress: "",
  notes: "",
  tags: [],
  status: "active",
};
export function ContactEditor({
  initial,
  onClose,
  onSaved,
  onForbidden,
}: {
  initial: Contact | null;
  onClose: () => void;
  onSaved: () => void;
  onForbidden: () => void;
}) {
  const confirmation = useConfirmation();
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.querySelector("input")?.focus({ preventScroll: true });
  }, []);
  const [base, setBase] = useState(initial);
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [draft, setDraft] = useState(initial?.data ?? defaults);
  const [tags, setTags] = useState(base?.data.tags.join(", ") ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(base?.data ?? defaults) ||
    tags !== (base?.data.tags.join(", ") ?? "");
  const close = async () => {
    if (
      !pending &&
      (!dirty ||
        (await confirmation.confirm("Discard your unsaved contact changes?", {
          title: "Discard contact changes?",
          confirmLabel: "Discard changes",
        })))
    )
      onClose();
  };
  function update<K extends keyof ContactInput>(
    key: K,
    value: ContactInput[K],
  ) {
    setDraft({ ...draft, [key]: value });
  }
  async function reload() {
    if (
      pending ||
      !(await confirmation.confirm(
        "Discard your draft and load the latest contact?",
        { title: "Reload contact?", confirmLabel: "Discard and reload" },
      ))
    )
      return;
    setPending(true);
    try {
      const latest = await apiRequest(`/contacts/${id}`, {}, contactSchema);
      setBase(latest);
      setDraft(latest.data);
      setTags(latest.data.tags.join(", "));
      setConflict(false);
      setError("");
    } catch (failure) {
      if (failure instanceof ApiError && [401, 403].includes(failure.status))
        onForbidden();
      setError("Could not load the latest contact. Your draft is still here.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <UnsavedChanges dirty={dirty} pending={pending} />
      <Dialog
        open
        actions={null}
        className="contact-editor-dialog"
        title={initial ? "Edit contact" : "Add contact"}
        onClose={close}
      >
        <form
          ref={form}
          className="contact-editor-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending || conflict) return;
            const parsed = contactInput.safeParse({
              ...draft,
              tags: tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            });
            if (!parsed.success) {
              setError(parsed.error.issues[0].message);
              return;
            }
            setPending(true);
            setError("");
            try {
              await apiRequest(
                initial ? `/contacts/${id}` : "/contacts",
                {
                  method: initial ? "PUT" : "POST",
                  body: JSON.stringify(
                    initial
                      ? { data: parsed.data, version: base!.version }
                      : { id, data: parsed.data },
                  ),
                },
                contactSchema,
              );
              onSaved();
            } catch (failure) {
              if (
                failure instanceof ApiError &&
                [401, 403].includes(failure.status)
              )
                onForbidden();
              setConflict(
                failure instanceof ApiError && failure.status === 409,
              );
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Could not save. Your draft is still here.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="contact-editor-body">
            <p className="contact-editor-intro">
              Save contact and billing details in one place. Only the name is
              required.
            </p>
            <fieldset disabled={pending} className="contact-editor-section">
              <legend>Contact details</legend>
              <div className="contact-editor-grid">
                <Field
                  label="Contact name"
                  required
                  maxLength={120}
                  value={draft.name}
                  onChange={(e) => update("name", e.target.value)}
                />
                <Field
                  label="Company"
                  maxLength={120}
                  value={draft.company}
                  onChange={(e) => update("company", e.target.value)}
                />
                <Field
                  label="Contact email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                <Field
                  label="Contact phone"
                  type="tel"
                  maxLength={40}
                  value={draft.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </fieldset>
            <fieldset disabled={pending} className="contact-editor-section">
              <legend>Billing details</legend>
              <div className="contact-editor-fields">
                <div>
                  <Field
                    label="Legal / billing name"
                    aria-describedby="contact-legal-name-help"
                    maxLength={120}
                    value={draft.legalName}
                    onChange={(e) => update("legalName", e.target.value)}
                  />
                  <p className="hint" id="contact-legal-name-help">
                    Optional. Overrides the company or contact name on invoices.
                  </p>
                </div>
                <div>
                  <TextAreaField
                    label="Billing address"
                    aria-describedby="contact-billing-address-help"
                    rows={3}
                    maxLength={500}
                    value={draft.billingAddress}
                    onChange={(e) => update("billingAddress", e.target.value)}
                  />
                  <p className="hint" id="contact-billing-address-help">
                    Include postal code and country, formatted for invoices.
                  </p>
                </div>
              </div>
            </fieldset>
            <fieldset disabled={pending} className="contact-editor-section">
              <legend>Internal notes</legend>
              <div className="contact-editor-fields">
                <div className="contact-editor-grid">
                  <Field
                    label="Tags (comma separated)"
                    maxLength={820}
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                  />
                  <SelectField
                    label="Status"
                    value={draft.status}
                    onChange={(e) =>
                      update("status", e.target.value as ContactInput["status"])
                    }
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </SelectField>
                </div>
                <TextAreaField
                  label="Private notes"
                  rows={3}
                  maxLength={4000}
                  value={draft.notes}
                  onChange={(e) => update("notes", e.target.value)}
                />
              </div>
            </fieldset>
          </div>
          <div className="contact-editor-footer">
            <FormFeedback message={error} error focus={false} />
            <div className="dialog-actions">
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => void close()}
              >
                Cancel
              </Button>
              {conflict && (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => void reload()}
                >
                  Discard draft and load latest
                </Button>
              )}
              <Button type="submit" disabled={pending || conflict}>
                {pending ? "Saving…" : "Save contact"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </>
  );
}
