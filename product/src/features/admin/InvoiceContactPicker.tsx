import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/api/client";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  contactBillingChoicesSchema,
  contactInvoiceRecipient,
  type ContactBillingChoice,
} from "../../../shared/contacts";

export function InvoiceContactPicker({
  userId,
  onClose,
  onApply,
  hasAccount,
}: {
  userId: string;
  onClose: () => void;
  onApply: (contact: ContactBillingChoice) => void;
  hasAccount: boolean;
}) {
  const [draftSearch, setDraftSearch] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactBillingChoice | null>(null);
  const query = useQuery({
    queryKey: ["owner", "invoice-contacts", userId, search],
    queryFn: ({ signal }) =>
      apiRequest(
        `/contacts/invoice-choices?${new URLSearchParams({ search })}`,
        { signal },
        contactBillingChoicesSchema,
      ),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  });
  const recipient = selected ? contactInvoiceRecipient(selected) : null;
  function find() {
    setSearch(draftSearch.trim());
    setSelected(null);
  }
  return (
    <Dialog
      open
      title="Use saved contact"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!selected || query.isFetching || query.isError}
            onClick={() => {
              if (selected) onApply(selected);
            }}
          >
            Use billing details
          </Button>
        </>
      }
    >
      <p>
        Copy a contact’s billing name, address and email into this invoice. You
        can edit the copied details without changing the contact.
      </p>
      <div className="invoice-contact-search">
        <Field
          label="Find saved contact"
          placeholder="Name, company, email or phone"
          maxLength={100}
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              find();
            }
          }}
        />
        <Button variant="secondary" onClick={find}>
          Search contacts
        </Button>
      </div>
      {query.isFetching ? (
        <p role="status">Finding contacts…</p>
      ) : query.isError ? (
        <div>
          <p role="alert">
            Could not load saved contacts. Check your contact access or try
            again.
          </p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry contacts
          </Button>
        </div>
      ) : !query.data?.items.length ? (
        <p>
          No matching active contacts. Try another search or add a contact in
          Contacts.
        </p>
      ) : (
        <>
          <p className="hint">
            Up to 20 active contacts. Refine your search to find another
            contact.
          </p>
          <ul
            className="invoice-contact-results"
            aria-label="Matching contacts"
          >
            {query.data.items.map((contact) => (
              <li key={contact.id}>
                <button
                  type="button"
                  className="invoice-contact-choice"
                  aria-pressed={selected?.id === contact.id}
                  onClick={() => setSelected(contact)}
                >
                  <strong>{contact.name}</strong>
                  <span>
                    {[contact.legalName || contact.company, contact.email]
                      .filter(Boolean)
                      .join(" · ") || "No company or email added"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {recipient && (
        <section
          className="invoice-contact-preview"
          aria-label="Billing details preview"
          aria-live="polite"
        >
          <h3>Billing details to use</h3>
          <p>
            <strong>{recipient.billToName}</strong>
          </p>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {recipient.billToAddress || "No billing address saved"}
          </p>
          <p>{recipient.billToEmail || "No email saved"}</p>
          <p className="hint">
            This replaces the invoice’s current billing name, address and email,
            including blank values.{" "}
            {hasAccount
              ? "The linked account will be removed. Link an account separately if needed."
              : "This does not link an account or grant invoice access."}
          </p>
        </section>
      )}
    </Dialog>
  );
}
