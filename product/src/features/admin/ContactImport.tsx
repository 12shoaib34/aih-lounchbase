import { FormFeedback } from "@/components/ui/FormFeedback";
import { useRef, useState } from "react";
import { z } from "zod";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { apiRequest, ApiError } from "@/api/client";
import { contactColumns, readContactCsv } from "../../../shared/contact-csv";
import type { ContactInput } from "../../../shared/contacts";

export function ContactImport({
  onImported,
  onForbidden,
  canImport,
  canExport,
}: {
  onImported: () => void;
  onForbidden: () => void;
  canImport: boolean;
  canExport: boolean;
}) {
  const fileSelection = useRef(0);
  const [source, setSource] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [items, setItems] = useState<{ id: string; data: ContactInput }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = source ? readContactCsv(source, mapping) : null;
  return (
    <details className="component-card">
      <summary>Import and export contacts</summary>
      <p>
        CSV files up to 1 MiB and 500 rows. Use | between tags in your own CSV.
        Downloaded CSVs preserve exact tag values. Imports add records; they do
        not merge existing contacts by email. Re-selecting a file starts a new
        import. Exports include all statuses, up to 1000 records, and protect
        spreadsheet formula cells.
      </p>
      {canExport && <a href="/api/contacts/export">Download contacts CSV</a>}
      {canImport && (
        <Field
          label="Contact CSV"
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={async (event) => {
            const selection = ++fileSelection.current;
            setSource("");
            setItems([]);
            setMessage("");
            setErrors([]);
            setMapping({});
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 1048576) {
              setErrors(["Choose a CSV file up to 1 MiB."]);
              return;
            }
            try {
              const text = await file.text();
              if (fileSelection.current === selection) setSource(text);
            } catch {
              if (fileSelection.current === selection)
                setErrors(["The file could not be read."]);
            }
          }}
        />
      )}
      {canImport && parsed && (
        <>
          <div className="settings-fields">
            {contactColumns.map((key) => (
              <SelectField
                key={key}
                label={`Column for ${key}`}
                disabled={pending}
                value={
                  mapping[key] ?? (parsed.headers.includes(key) ? key : "")
                }
                onChange={(event) => {
                  setMapping({ ...mapping, [key]: event.target.value });
                  setErrors([]);
                  setItems([]);
                  setMessage("");
                }}
              >
                <option value="">
                  {key === "name"
                    ? "Select a name column"
                    : key === "status"
                      ? "Use active status"
                      : "Skip this field"}
                </option>
                {parsed.headers.map((header) => (
                  <option key={header}>{header}</option>
                ))}
              </SelectField>
            ))}
          </div>
          <Button
            disabled={pending || items.length > 0}
            onClick={() => {
              setErrors(parsed.errors);
              setItems(
                parsed.errors.length
                  ? []
                  : parsed.rows.map((data) => ({
                      id: crypto.randomUUID(),
                      data,
                    })),
              );
              setMessage("");
            }}
          >
            Validate and preview
          </Button>
        </>
      )}
      {!!errors.length && (
        <div className="form-feedback form-feedback-error" role="alert">
          <p>Import blocked. Fix the file or mapping:</p>
          <ul>
            {errors.slice(0, 20).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          {errors.length > 20 && <p>{errors.length - 20} additional errors.</p>}
        </div>
      )}
      {canImport && !!items.length && (
        <>
          <p>{items.length} valid contacts. Showing the first 10.</p>
          <DataTable
            caption="Contact import preview"
            rows={items.slice(0, 10)}
            rowKey={(row) => row.id}
            empty="No rows"
            columns={[
              { key: "name", label: "Name", render: (row) => row.data.name },
              { key: "email", label: "Email", render: (row) => row.data.email },
              { key: "notes", label: "Notes", render: (row) => row.data.notes },
              {
                key: "company",
                label: "Company",
                render: (row) => row.data.company,
              },
            ]}
          />
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setErrors([]);
              setMessage("");
              try {
                const result = await apiRequest(
                  "/contacts/import",
                  { method: "POST", body: JSON.stringify({ items }) },
                  z.object({ inserted: z.number(), unchanged: z.number() }),
                );
                setMessage(
                  `Imported ${result.inserted}; ${result.unchanged} already present from this attempt.`,
                );
                setItems([]);
                setSource("");
                onImported();
              } catch (failure) {
                if (
                  failure instanceof ApiError &&
                  [401, 403].includes(failure.status)
                )
                  onForbidden();
                setErrors([
                  failure instanceof ApiError
                    ? failure.message
                    : "Import failed. Retry this same preview to avoid duplicates.",
                ]);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Importing…" : `Import ${items.length} contacts`}
          </Button>
        </>
      )}
      <FormFeedback message={message} focus={false} />
    </details>
  );
}
