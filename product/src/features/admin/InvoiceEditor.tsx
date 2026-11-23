import { InvoiceContactPicker } from "./InvoiceContactPicker";
import { contactInvoiceRecipient } from "../../../shared/contacts";
import { newInvoiceDocument } from "../../../shared/invoiceDefaults";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { invoiceDownloadError } from "./invoiceDownloadError";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link, useLocation } from "@/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { UnsavedChanges } from "@/components/ui/UnsavedChanges";
import {
  invoiceDefaultsSchema,
  invoiceInput,
  invoiceTotals,
  invoiceDocument,
  invoiceDetailsSchema,
  formatMoney,
  parseInvoicePrice as parsePrice,
  invoiceLineAmount,
  type InvoiceDetails,
} from "../../../shared/billing";
import {
  InvoiceCustomerPicker,
  type InvoiceCustomer,
} from "./InvoiceCustomerPicker";

import { InvoiceLogo } from "./InvoiceLogo";

type Item = {
  key: string;
  description: string;
  quantity: string;
  price: string;
};
const blankItem = (): Item => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: "1",
  price: "0",
});
function itemDraft(invoice: InvoiceDetails): Item[] {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: invoice.currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  return invoice.items.map((item) => ({
    key: crypto.randomUUID(),
    description: item.description,
    quantity: String(item.quantity),
    price: (item.unitAmount / 10 ** digits).toFixed(digits),
  }));
}
const recoverySchema = z.object({
  id: z.uuid(),
  version: z.number().int().nullable(),
  updatedAt: z.number(),
  // Recovery must retain unfinished/invalid fields so validation can be corrected.
  document: z.object({
    ...invoiceDocument.shape,
    sellerEmail: z.string(),
    billToEmail: z.string(),
    invoiceDate: z.string(),
    dueDate: z.string(),
  }),
  currency: invoiceDefaultsSchema.shape.currency,
  customer: z
    .object({ id: z.string(), name: z.string(), email: z.string().optional() })
    .nullable(),
  items: z
    .array(
      z.object({
        key: z.string(),
        description: z.string(),
        quantity: z.string(),
        price: z.string(),
      }),
    )
    .min(1)
    .max(30),
  baseline: z.string(),
  attempt: invoiceInput.nullable(),
});
type Recovery = z.infer<typeof recoverySchema>;
type EditorProps = {
  userId: string;
  initial?: InvoiceDetails;
  defaults?: z.infer<typeof invoiceDefaultsSchema>;
  canUseContacts?: boolean;
};
function readRecovery(key: string) {
  try {
    const parsed = recoverySchema.safeParse(
      JSON.parse(sessionStorage.getItem(key) || "null"),
    );
    if (parsed.success && Date.now() - parsed.data.updatedAt < 86400000)
      return parsed.data;
    sessionStorage.removeItem(key);
  } catch {
    /* Storage may be unavailable. Saving on the server still works. */
  }
  return null;
}
function writeRecovery(key: string, value: object) {
  sessionStorage.setItem(
    key,
    JSON.stringify({ ...value, updatedAt: Date.now() }),
  );
}
function clearRecovery(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* Optional recovery. */
  }
}
export function InvoiceEditor(props: EditorProps) {
  const location = useLocation();
  const recoveryKey = `invoice-draft:${props.userId}:${props.initial?.id ?? "new"}`;
  const [candidate, setCandidate] = useState(() => readRecovery(recoveryKey));
  const [restored, setRestored] = useState<Recovery | null>(null);
  if (candidate)
    return (
      <>
        <PageHeader
          title={props.initial ? "Edit draft" : "New invoice"}
          description="Unsaved changes available"
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Billing", to: `/admin/billing${location.search}` },
                { label: props.initial ? "Edit draft" : "New invoice" },
              ]}
            />
          }
        />
        <section className="component-card">
          <h2>Recover unsaved invoice?</h2>
          <p>
            This tab has changes from{" "}
            {new Date(candidate.updatedAt).toLocaleString()}. They have not been
            confirmed saved.
          </p>
          {candidate.version !== null &&
            candidate.version !== props.initial?.version && (
              <p role="alert">
                The saved invoice has changed. Recovered edits cannot overwrite
                it without a version check.
              </p>
            )}
          <div className="account-actions">
            <Button
              onClick={() => {
                setRestored(candidate);
                setCandidate(null);
              }}
            >
              Recover changes
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                clearRecovery(recoveryKey);
                setCandidate(null);
              }}
            >
              Discard recovery
            </Button>
          </div>
        </section>
      </>
    );
  return (
    <InvoiceEditorForm
      {...props}
      recovery={restored}
      recoveryKey={recoveryKey}
    />
  );
}
function InvoiceEditorForm({
  userId,
  initial,
  defaults,
  recovery,
  recoveryKey,
  canUseContacts = false,
}: EditorProps & { recovery: Recovery | null; recoveryKey: string }) {
  const confirmation = useConfirmation();
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const cache = useQueryClient();
  const router = useRouter();
  const location = useLocation();
  const form = useRef<HTMLFormElement>(null);
  const [base, setBase] = useState(
    initial && recovery?.version != null
      ? { ...initial, version: recovery.version }
      : initial,
  );
  const [id] = useState(
    () => recovery?.id ?? initial?.id ?? crypto.randomUUID(),
  );
  const [customer, setCustomer] = useState<InvoiceCustomer | null>(
    recovery
      ? recovery.customer
      : initial?.customerId
        ? { id: initial.customerId, name: initial.customerName }
        : null,
  );
  const [currency, setCurrency] = useState(
    recovery?.currency ?? initial?.currency ?? defaults?.currency ?? "USD",
  );
  const [items, setItems] = useState<Item[]>(
    () => recovery?.items ?? (initial ? itemDraft(initial) : [blankItem()]),
  );
  const [document, setDocument] = useState(
    () =>
      recovery?.document ?? initial?.document ?? newInvoiceDocument(defaults),
  );
  const [sellerText, setSellerText] = useState(() =>
    [document.sellerName, document.sellerAddress].filter(Boolean).join("\n"),
  );
  const [billingText, setBillingText] = useState(() =>
    [document.billToName, document.billToAddress].filter(Boolean).join("\n"),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTax, setShowTax] = useState(true);
  const [showDiscount, setShowDiscount] = useState(!!Number(document.discount));
  const [showShipping, setShowShipping] = useState(!!Number(document.shipping));
  const values = {
    document,
    customerId: customer?.id ?? "",
    currency,
    items: items.map(({ description, quantity, price }) => ({
      description,
      quantity,
      price,
    })),
  };
  const [baseline, setBaseline] = useState(
    () => recovery?.baseline ?? JSON.stringify(values),
  );
  const [operation, setOperation] = useState<
    "save" | "download" | "reload" | null
  >(null);
  const pending = operation !== null;
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [attempt, setAttempt] = useState<z.infer<typeof invoiceInput> | null>(
    recovery?.attempt ?? null,
  );
  const [saved, setSaved] = useState(false);
  const dirty = !saved && JSON.stringify(values) !== baseline;
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const snapshot = JSON.stringify({
    id,
    version: base?.version ?? null,
    document,
    currency,
    customer,
    items,
    baseline,
    attempt,
  });
  useEffect(() => {
    if (saved || !dirty) {
      clearRecovery(recoveryKey);
      return;
    }
    try {
      writeRecovery(recoveryKey, JSON.parse(snapshot));
    } catch {
      // A storage failure is an external-system result that must be visible to the user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecoveryFailed(true);
    }
  }, [snapshot, dirty, saved, recoveryKey]);
  const locked = pending || (!base && !!attempt);
  const forbidden = (failure: unknown) => {
    if (failure instanceof ApiError && [401, 403].includes(failure.status))
      void cache.invalidateQueries({ queryKey: ["owner", "access"] });
  };
  useEffect(() => {
    if (saved) {
      void cache.invalidateQueries({ queryKey: ["billing"] });
      try {
        window.sessionStorage.setItem("saved-invoice", id);
      } catch {
        /* Storage is optional. */
      }
      router.replace(`/app/admin/billing/${id}${location.search}`);
    }
  }, [saved, id, router, cache, location.search]);
  function changeItem(key: string, changes: Partial<Item>) {
    setErrors({});
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, ...changes } : item,
      ),
    );
  }
  const [reorderMenu, setReorderMenu] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [orderAnnouncement, setOrderAnnouncement] = useState("");
  const drag = useRef<{
    key: string;
    target: string;
    startY: number;
    moved: boolean;
  } | null>(null);
  const suppressHandleClick = useRef(false);
  function moveItemTo(key: string, target: string) {
    const source = items.findIndex((item) => item.key === key);
    const destination = items.findIndex((item) => item.key === target);
    if (source < 0 || destination < 0 || source === destination) return;
    const next = [...items];
    const [item] = next.splice(source, 1);
    next.splice(destination, 0, item);
    setItems(next);
    setErrors({});
    setReorderMenu(null);
    setOrderAnnouncement(
      `Item moved to position ${destination + 1} of ${next.length}.`,
    );
    requestAnimationFrame(() =>
      window.document.getElementById(`reorder-${key}`)?.focus(),
    );
  }
  const totals = items.map((item) => {
    try {
      const quantity = Number(item.quantity);
      return Number.isFinite(quantity) &&
        quantity >= 0.001 &&
        quantity <= 1000 &&
        Math.abs(quantity * 1000 - Math.round(quantity * 1000)) < 0.000001
        ? invoiceLineAmount({
            unitAmount: parsePrice(item.price, currency),
            quantity,
          })
        : null;
    } catch {
      return null;
    }
  });
  const total = totals.every((value) => value !== null)
    ? totals.reduce<number>((sum, value) => sum + value!, 0)
    : null;
  let preview: ReturnType<typeof invoiceTotals> | null = null;
  let totalError = "";
  try {
    if (total !== null)
      preview = invoiceTotals({
        currency,
        document,
        items: items.map((item) => ({
          quantity: Number(item.quantity),
          unitAmount: parsePrice(item.price, currency),
        })),
      });
  } catch (failure) {
    totalError = (failure as Error).message;
  }
  const money = (value: number | undefined) =>
    value === undefined ? "—" : formatMoney(value, currency);
  const docField = (
    key:
      | "sellerName"
      | "sellerEmail"
      | "billToName"
      | "billToEmail"
      | "invoiceDate"
      | "dueDate"
      | "reference"
      | "paymentTerms"
      | "purchaseOrder",
    label: string,
    type = "text",
  ) => (
    <Field
      label={label}
      type={type}
      disabled={locked}
      value={document[key]}
      placeholder={type === "email" ? "Optional" : undefined}
      error={errors[key]}
      maxLength={type === "email" ? 254 : key === "reference" ? 60 : 120}
      onChange={(e) => setDocument({ ...document, [key]: e.target.value })}
    />
  );
  const removeAdjustment = (key: "tax" | "discount" | "shipping") => {
    setDocument((current) => ({
      ...current,
      [key]: "0",
      ...(key !== "shipping" ? { [`${key}Mode`]: "percent" as const } : {}),
    }));
    if (key === "tax") setShowTax(false);
    else if (key === "discount") setShowDiscount(false);
    else setShowShipping(false);
    requestAnimationFrame(() =>
      form.current
        ?.querySelector<HTMLButtonElement>(`[data-add-adjustment="${key}"]`)
        ?.focus(),
    );
  };
  const currencySymbol =
    new Intl.NumberFormat("en", { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency;
  const adjustment = (key: "tax" | "discount", label: string) => (
    <div className="generator-adjustment">
      <span className="generator-adjustment-label" aria-hidden="true">
        {label}
      </span>
      <div
        className={`generator-adjustment-controls ${document[`${key}Mode`] === "percent" ? "is-percent" : "is-flat"}`}
      >
        <span className="generator-adjustment-unit" aria-hidden="true">
          {document[`${key}Mode`] === "percent" ? "%" : currencySymbol}
        </span>
        <Field
          id={`${id}-${key}`}
          label={label}
          inputMode="decimal"
          value={document[key]}
          onChange={(e) => setDocument({ ...document, [key]: e.target.value })}
        />
        <button
          type="button"
          className="generator-mode-toggle"
          aria-label={`Switch ${label.toLowerCase()} to ${document[`${key}Mode`] === "percent" ? "fixed amount" : "percentage"}`}
          title={
            document[`${key}Mode`] === "percent"
              ? "Use a fixed amount"
              : "Use a percentage"
          }
          onClick={() =>
            setDocument({
              ...document,
              [`${key}Mode`]:
                document[`${key}Mode`] === "percent" ? "flat" : "percent",
            })
          }
        >
          ⇄
        </button>
      </div>
      <button
        type="button"
        className="generator-remove-adjustment"
        aria-label={`Remove ${key}`}
        onClick={() => removeAdjustment(key)}
      >
        ×
      </button>
    </div>
  );
  const moneyAdjustment = (key: "shipping" | "amountPaid", label: string) => (
    <div className="generator-adjustment">
      <span className="generator-adjustment-label" aria-hidden="true">
        {label}
      </span>
      <div className="generator-money-control">
        <span className="generator-money-unit" aria-hidden="true">
          {currencySymbol}
        </span>
        <Field
          id={`${id}-${key}`}
          label={label}
          inputMode="decimal"
          value={document[key]}
          onChange={(e) => setDocument({ ...document, [key]: e.target.value })}
        />
      </div>
      {key === "shipping" && (
        <button
          type="button"
          className="generator-remove-adjustment"
          aria-label="Remove shipping"
          onClick={() => removeAdjustment("shipping")}
        >
          ×
        </button>
      )}
    </div>
  );
  async function reload() {
    if (
      !(await confirmation.confirm(
        "Discard your changes and load the latest invoice?",
        { title: "Reload invoice?", confirmLabel: "Discard and reload" },
      ))
    )
      return;
    setOperation("reload");
    try {
      const latest = await apiRequest(
        `/billing/${id}`,
        {},
        invoiceDetailsSchema,
      );
      const nextItems = itemDraft(latest);
      setDocument(latest.document);
      setSellerText(
        [latest.document.sellerName, latest.document.sellerAddress]
          .filter(Boolean)
          .join("\n"),
      );
      setBillingText(
        [latest.document.billToName, latest.document.billToAddress]
          .filter(Boolean)
          .join("\n"),
      );
      setShowTax(true);
      setShowDiscount(!!Number(latest.document.discount));
      setShowShipping(!!Number(latest.document.shipping));
      setBase(latest);
      setCurrency(latest.currency);
      setCustomer(
        latest.customerId
          ? { id: latest.customerId, name: latest.customerName }
          : null,
      );
      setItems(nextItems);
      setBaseline(
        JSON.stringify({
          document: latest.document,
          customerId: latest.customerId ?? "",
          currency: latest.currency,
          items: nextItems.map(({ description, quantity, price }) => ({
            description,
            quantity,
            price,
          })),
        }),
      );
      setConflict(false);
      setError("");
      setErrors({});
    } catch (failure) {
      forbidden(failure);
      setError("Could not load the invoice. Your changes are still here.");
    } finally {
      setOperation(null);
    }
  }
  if (base && base.status !== "draft")
    return (
      <>
        <p>This invoice is {base.status} and cannot be edited.</p>
        <Link to={`/admin/billing/${id}${location.search}`}>
          Review invoice
        </Link>
      </>
    );
  return (
    <>
      <UnsavedChanges
        dirty={dirty}
        pending={pending}
        pendingMessage={
          operation === "download"
            ? "Wait for PDF preparation to finish."
            : operation === "reload"
              ? "Wait for the invoice to reload."
              : undefined
        }
        onDiscard={() => clearRecovery(recoveryKey)}
      />
      {recoveryFailed && (
        <p role="status">
          Tab recovery is unavailable. Save your draft before refreshing.
        </p>
      )}
      {canUseContacts && contactPickerOpen && (
        <InvoiceContactPicker
          userId={userId}
          hasAccount={!!customer}
          onClose={() => setContactPickerOpen(false)}
          onApply={(contact) => {
            const recipient = contactInvoiceRecipient(contact);
            setDocument((current) => ({ ...current, ...recipient }));
            setBillingText(
              [recipient.billToName, recipient.billToAddress]
                .filter(Boolean)
                .join("\n"),
            );
            setCustomer(null);
            setErrors({});
            setContactPickerOpen(false);
          }}
        />
      )}
      <span className="sr-only" role="status">
        {operation === "save"
          ? "Saving invoice…"
          : operation === "download"
            ? "Preparing PDF…"
            : operation === "reload"
              ? "Reloading invoice…"
              : ""}
      </span>
      <form
        ref={form}
        noValidate
        aria-busy={pending}
        className="invoice-editor"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          const target = event.target;
          if (
            !(target instanceof HTMLInputElement) ||
            target.getAttribute("role") === "combobox" ||
            target.type === "file"
          )
            return;
          event.preventDefault();
          const row = target.closest(".invoice-item");
          const inputs = Array.from(
            (row ?? form.current)?.querySelectorAll<HTMLInputElement>(
              "input:not(:disabled)",
            ) ?? [],
          );
          inputs[inputs.indexOf(target) + 1]?.focus();
        }}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending || conflict || saved) return;
          const fieldErrors: Record<string, string> = {};
          const downloading =
            (event.nativeEvent as SubmitEvent).submitter?.getAttribute(
              "value",
            ) === "download";
          const parsedItems = items.map((item, index) => {
            let unitAmount = 0;
            try {
              unitAmount = parsePrice(item.price, currency);
            } catch (failure) {
              fieldErrors[`price-${index}`] = (failure as Error).message;
            }
            const quantity = Number(item.quantity);
            if (
              !Number.isFinite(quantity) ||
              quantity < 0.001 ||
              quantity > 1000 ||
              Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001
            )
              fieldErrors[`quantity-${index}`] =
                "Enter a quantity from 0.001 to 1000, with up to three decimals.";
            if (!item.description.trim())
              fieldErrors[`description-${index}`] = "Enter a description.";
            return { description: item.description, quantity, unitAmount };
          });
          if (!document.sellerName.trim())
            fieldErrors.sellerName = "Enter the seller name.";
          if (!document.billToName.trim())
            fieldErrors.billToName = "Enter the billing name.";
          if (!document.invoiceDate)
            fieldErrors.invoiceDate = "Enter the invoice date.";
          const parsedDocument = invoiceDocument.safeParse(document);
          if (!parsedDocument.success)
            for (const issue of parsedDocument.error.issues)
              fieldErrors[String(issue.path[0])] =
                issue.path[0] === "title" && !document.title.trim()
                  ? "Enter a document title."
                  : issue.message;
          const parsed = invoiceInput.safeParse({
            document,
            customerId: customer?.id ?? null,
            currency,
            items: parsedItems,
          });
          if (
            !attempt &&
            (!parsed.success || Object.keys(fieldErrors).length)
          ) {
            if (fieldErrors.customer || fieldErrors.sellerEmail)
              setSettingsOpen(true);
            setErrors(fieldErrors);
            setError(
              Object.keys(fieldErrors).length
                ? "Check the highlighted fields."
                : (parsed.error?.issues[0]?.message ?? "Check the invoice."),
            );
            requestAnimationFrame(() =>
              form.current
                ?.querySelector<HTMLElement>('[aria-invalid="true"]')
                ?.focus(),
            );
            return;
          }
          const data = attempt ?? parsed.data!;
          setOperation(downloading ? "download" : "save");
          setErrors({});
          setError("");
          if (downloading) {
            try {
              const { downloadInvoice } = await import("./invoicePdf");
              await downloadInvoice({
                ...data,
                number: base?.number ?? "draft",
                status: "draft",
              });
            } catch (failure) {
              setError(invoiceDownloadError(failure));
            } finally {
              setOperation(null);
            }
            return;
          }
          if (!base) setAttempt(data);
          // Persist request identity before the network call, including lost responses.
          try {
            writeRecovery(recoveryKey, {
              ...JSON.parse(snapshot),
              attempt: base ? null : data,
            });
          } catch {
            setRecoveryFailed(true);
          }
          try {
            await apiRequest(
              base ? `/billing/${id}` : "/billing",
              {
                method: base ? "PUT" : "POST",
                body: JSON.stringify(
                  base ? { version: base.version, data } : { id, data },
                ),
              },
              z.object({ id: z.uuid() }),
            );
            setSaved(true);
          } catch (failure) {
            forbidden(failure);
            setConflict(
              !!base && failure instanceof ApiError && failure.status === 409,
            );
            if (!base && failure instanceof ApiError && failure.status === 400)
              setAttempt(null);
            setError(
              failure instanceof ApiError
                ? failure.message
                : "Could not confirm the save. Your draft is still here; retry to check the same request.",
            );
          } finally {
            setOperation(null);
          }
        }}
      >
        <PageHeader
          title={base ? "Edit draft" : "New invoice"}
          description={
            base ? (dirty ? "Unsaved changes" : "Saved draft") : undefined
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Billing", to: `/admin/billing${location.search}` },
                ...(base
                  ? [
                      {
                        label: base.document.reference || base.number,
                        to: `/admin/billing/${id}${location.search}`,
                      },
                    ]
                  : []),
                { label: base ? "Edit draft" : "New invoice" },
              ]}
            />
          }
          actions={
            <>
              <Link
                className="page-header-cancel"
                to={
                  (base ? `/admin/billing/${id}` : "/admin/billing") +
                  location.search
                }
              >
                Cancel
              </Link>
              <Button
                className="generator-download"
                aria-label="Download PDF"
                variant="secondary"
                type="submit"
                name="action"
                value="download"
                disabled={pending || !!attempt}
              >
                {" "}
                {operation === "download" ? "Preparing PDF…" : "Download PDF"}
              </Button>
              <Button
                type="submit"
                disabled={pending || conflict || saved || (!!base && !dirty)}
              >
                {operation === "save"
                  ? "Saving…"
                  : attempt
                    ? "Retry save"
                    : "Save draft"}
              </Button>
            </>
          }
        />
        {attempt && !pending && (
          <p className="hint">
            Retry uses the same invoice request.{" "}
            <Link to={`/admin/billing/${id}${location.search}`}>
              Check saved invoice
            </Link>
          </p>
        )}
        {conflict && (
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => void reload()}
          >
            Discard changes and load latest
          </Button>
        )}
        <div className="generator-layout">
          <aside
            className="generator-sidebar"
            aria-labelledby="invoice-summary"
          >
            <h2 id="invoice-summary" className="sr-only">
              Summary
            </h2>
            <div className="invoice-command-bar">
              <SelectField
                label="Currency"
                aria-label="Invoice currency"
                disabled={locked}
                value={currency}
                onChange={async (event) => {
                  const next = event.target.value;
                  if (
                    (items.some(
                      (item) => item.price !== "" && Number(item.price) !== 0,
                    ) ||
                      Number(document.shipping) !== 0 ||
                      Number(document.amountPaid) !== 0 ||
                      (document.taxMode === "flat" &&
                        Number(document.tax) !== 0) ||
                      (document.discountMode === "flat" &&
                        Number(document.discount) !== 0)) &&
                    !(await confirmation.confirm(
                      "Change currency and clear all unit prices? Amounts will not be converted.",
                      {
                        title: "Change currency?",
                        confirmLabel: "Change currency",
                      },
                    ))
                  )
                    return;
                  setCurrency(next);
                  setDocument((current) => ({
                    ...current,
                    tax: current.taxMode === "flat" ? "0" : current.tax,
                    discount:
                      current.discountMode === "flat" ? "0" : current.discount,
                    shipping: "0",
                    amountPaid: "0",
                  }));
                  setItems((current) =>
                    current.map((item) => ({ ...item, price: "" })),
                  );
                  setErrors({});
                }}
              >
                {Intl.supportedValuesOf("currency").map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </SelectField>
              <Button
                type="button"
                variant="secondary"
                className="invoice-options-toggle"
                aria-expanded={settingsOpen}
                aria-controls="invoice-options"
                onClick={() => setSettingsOpen(!settingsOpen)}
              >
                Options
              </Button>
            </div>
            {error && (
              <p className="invoice-inline-error" role="alert">
                {error}
              </p>
            )}
            <p className="sr-only">
              {items.length} items · {money(preview?.balance)}
            </p>
            <section
              id="invoice-options"
              className="generator-settings"
              hidden={!settingsOpen}
              aria-label="Invoice options"
            >
              <div className="generator-settings-fields">
                {docField("sellerEmail", "Seller email", "email")}
                <section aria-labelledby="invoice-customer">
                  <h2 id="invoice-customer" className="sr-only">
                    Customer
                  </h2>
                  <InvoiceCustomerPicker
                    userId={userId}
                    selected={customer}
                    onSelect={(value) => {
                      setCustomer(value);
                      if (value) {
                        setBillingText(
                          [value.name, document.billToAddress]
                            .filter(Boolean)
                            .join("\n"),
                        );
                        setDocument((current) => ({
                          ...current,
                          billToName: value.name,
                        }));
                      }
                      setErrors({});
                    }}
                    error={errors.customer}
                    disabled={locked}
                  />
                </section>
              </div>
            </section>
          </aside>
          <fieldset disabled={locked} className="generator-paper">
            <legend className="sr-only">Invoice details</legend>
            <div className="generator-heading">
              <InvoiceLogo
                value={document.logo}
                onChange={(logo) => setDocument({ ...document, logo })}
              />
              <div className="generator-number">
                <Field
                  label="Document title"
                  value={document.title}
                  error={errors.title}
                  maxLength={60}
                  onChange={(e) =>
                    setDocument({ ...document, title: e.target.value })
                  }
                />
                {docField("reference", "Invoice number")}
              </div>
            </div>
            <div className="generator-parties">
              <div className="generator-addresses">
                <div className="generator-seller">
                  <TextAreaField
                    label="Seller name"
                    autoGrow
                    placeholder="Who is this from?"
                    rows={3}
                    maxLength={2121}
                    value={sellerText}
                    error={errors.sellerName || errors.sellerAddress}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setSellerText(raw);
                      const [sellerName, ...lines] = raw.split("\n");
                      setDocument({
                        ...document,
                        sellerName,
                        sellerAddress: lines.join("\n"),
                      });
                    }}
                  />
                </div>
                <div className="generator-recipients">
                  <div className="invoice-bill-to">
                    <TextAreaField
                      label="Bill to"
                      labelAction={
                        canUseContacts ? (
                          <button
                            type="button"
                            className="invoice-contact-trigger"
                            disabled={locked}
                            onClick={() => setContactPickerOpen(true)}
                          >
                            Use saved contact
                          </button>
                        ) : undefined
                      }
                      placeholder="Who is this to?"
                      rows={3}
                      maxLength={621}
                      value={billingText}
                      error={errors.billToName || errors.billToAddress}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setBillingText(raw);
                        const [billToName, ...lines] = raw.split("\n");
                        setDocument({
                          ...document,
                          billToName,
                          billToAddress: lines.join("\n"),
                        });
                      }}
                    />
                  </div>
                  <TextAreaField
                    label="Ship to"
                    rows={3}
                    placeholder="(optional)"
                    maxLength={500}
                    value={document.shipTo}
                    onChange={(e) =>
                      setDocument({ ...document, shipTo: e.target.value })
                    }
                  />
                </div>
                {docField("billToEmail", "Customer email", "email")}
              </div>
              <div className="generator-metadata">
                {docField("invoiceDate", "Date", "date")}
                {docField("paymentTerms", "Payment terms")}
                {docField("dueDate", "Due date", "date")}
                {docField("purchaseOrder", "PO number")}
              </div>
            </div>
            <section aria-labelledby="invoice-items">
              <h2 id="invoice-items" className="sr-only">
                Items
              </h2>
              <div className="generator-item-head" aria-hidden="true">
                <span>Item</span>
                <span>Quantity</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
              <p className="sr-only" aria-live="polite">
                {orderAnnouncement}
              </p>
              <p id="invoice-reorder-help" className="sr-only">
                Drag to reorder. Use Up and Down arrow keys, or open the menu
                for move actions.
              </p>
              {items.map((item, index) => (
                <fieldset
                  key={item.key}
                  className={`invoice-item generator-item ${dragTarget === item.key ? "is-drop-target" : ""}`}
                  data-item-key={item.key}
                >
                  <legend>Item {index + 1}</legend>
                  <Field
                    id={`item-${item.key}`}
                    label="Item description"
                    placeholder="Description of item/service..."
                    required
                    maxLength={160}
                    value={item.description}
                    error={errors[`description-${index}`]}
                    onChange={(e) =>
                      changeItem(item.key, { description: e.target.value })
                    }
                  />
                  <Field
                    label="Quantity"
                    type="number"
                    min={0}
                    max={1000}
                    step={1}
                    required
                    value={item.quantity}
                    error={errors[`quantity-${index}`]}
                    onChange={(e) =>
                      changeItem(item.key, { quantity: e.target.value })
                    }
                  />
                  <div
                    className="generator-rate"
                    data-currency={
                      new Intl.NumberFormat("en", {
                        style: "currency",
                        currency,
                      })
                        .formatToParts(0)
                        .find((part) => part.type === "currency")?.value
                    }
                  >
                    <Field
                      label={`Unit price (${currency})`}
                      inputMode="decimal"
                      required
                      value={item.price}
                      error={errors[`price-${index}`]}
                      onChange={(e) =>
                        changeItem(item.key, { price: e.target.value })
                      }
                    />
                  </div>
                  <div className="invoice-item-total">
                    <span>
                      {totals[index] === null
                        ? "—"
                        : formatMoney(totals[index], currency)}
                    </span>
                  </div>
                  <div className="generator-item-actions">
                    <div
                      className="generator-reorder"
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget))
                          setReorderMenu(null);
                      }}
                    >
                      <button
                        id={`reorder-${item.key}`}
                        type="button"
                        className="generator-drag-handle"
                        aria-label={`Reorder item ${index + 1}`}
                        aria-describedby="invoice-reorder-help"
                        aria-expanded={reorderMenu === item.key}
                        disabled={items.length === 1}
                        title="Drag to reorder or click for move options"
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setReorderMenu(null);
                            return;
                          }
                          if (
                            event.key !== "ArrowUp" &&
                            event.key !== "ArrowDown"
                          )
                            return;
                          event.preventDefault();
                          const target =
                            items[index + (event.key === "ArrowUp" ? -1 : 1)];
                          if (target) moveItemTo(item.key, target.key);
                        }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          suppressHandleClick.current = false;
                          drag.current = {
                            key: item.key,
                            target: item.key,
                            startY: event.clientY,
                            moved: false,
                          };
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
                        }}
                        onPointerMove={(event) => {
                          if (!drag.current) return;
                          if (
                            Math.abs(event.clientY - drag.current.startY) < 5 &&
                            !drag.current.moved
                          )
                            return;
                          drag.current.moved = true;
                          setReorderMenu(null);
                          const rows =
                            form.current?.querySelectorAll<HTMLElement>(
                              "[data-item-key]",
                            ) ?? [];
                          for (const row of rows) {
                            const bounds = row.getBoundingClientRect();
                            if (
                              event.clientY >= bounds.top &&
                              event.clientY <= bounds.bottom
                            ) {
                              drag.current.target = row.dataset.itemKey!;
                              setDragTarget(drag.current.target);
                              break;
                            }
                          }
                        }}
                        onPointerUp={() => {
                          const active = drag.current;
                          drag.current = null;
                          setDragTarget(null);
                          if (active?.moved) {
                            suppressHandleClick.current = true;
                            moveItemTo(active.key, active.target);
                          }
                        }}
                        onPointerCancel={() => {
                          drag.current = null;
                          setDragTarget(null);
                        }}
                        onClick={() => {
                          if (suppressHandleClick.current) {
                            suppressHandleClick.current = false;
                            return;
                          }
                          setReorderMenu(
                            reorderMenu === item.key ? null : item.key,
                          );
                        }}
                      >
                        <svg
                          width="14"
                          height="20"
                          viewBox="0 0 14 20"
                          aria-hidden="true"
                        >
                          {[4, 10, 16].map((y) => (
                            <g key={y}>
                              <circle
                                cx="4"
                                cy={y}
                                r="1.5"
                                fill="currentColor"
                              />
                              <circle
                                cx="10"
                                cy={y}
                                r="1.5"
                                fill="currentColor"
                              />
                            </g>
                          ))}
                        </svg>
                      </button>
                      {reorderMenu === item.key && (
                        <div
                          className="generator-reorder-menu"
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setReorderMenu(null);
                              window.document
                                .getElementById(`reorder-${item.key}`)
                                ?.focus();
                            }
                          }}
                        >
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() =>
                              moveItemTo(item.key, items[index - 1].key)
                            }
                          >
                            Move up
                          </button>
                          <button
                            type="button"
                            disabled={index === items.length - 1}
                            onClick={() =>
                              moveItemTo(item.key, items[index + 1].key)
                            }
                          >
                            Move down
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReorderMenu(null);
                              window.document
                                .getElementById(`reorder-${item.key}`)
                                ?.focus();
                            }}
                          >
                            Close
                          </button>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="secondary"
                      type="button"
                      aria-label={`Remove item ${index + 1}`}
                      disabled={items.length === 1}
                      onClick={() => {
                        const next = items.filter(
                          (row) => row.key !== item.key,
                        );
                        setItems(next);
                        setErrors({});
                        requestAnimationFrame(() =>
                          window.document
                            .getElementById(
                              `item-${next[Math.min(index, next.length - 1)].key}`,
                            )
                            ?.focus(),
                        );
                      }}
                    >
                      ×
                    </Button>
                  </div>
                </fieldset>
              ))}
              <Button
                variant="secondary"
                type="button"
                disabled={items.length >= 30}
                onClick={() => {
                  const item = blankItem();
                  setItems((current) => [...current, item]);
                  requestAnimationFrame(() =>
                    window.document.getElementById(`item-${item.key}`)?.focus(),
                  );
                }}
              >
                + Line item
              </Button>
            </section>
            <div className="generator-bottom">
              <div className="generator-notes">
                <TextAreaField
                  label="Notes"
                  autoGrow
                  rows={3}
                  maxLength={2000}
                  placeholder="Notes — any relevant information not already covered"
                  value={document.notes}
                  onChange={(e) =>
                    setDocument({ ...document, notes: e.target.value })
                  }
                />
                <TextAreaField
                  label="Terms"
                  autoGrow
                  rows={3}
                  maxLength={4000}
                  placeholder="Terms and conditions — payment methods, late fees, delivery schedule"
                  value={document.terms}
                  onChange={(e) =>
                    setDocument({ ...document, terms: e.target.value })
                  }
                />
              </div>
              <div className="generator-totals">
                <div className="generator-total-row">
                  <span>Subtotal</span>
                  <output>{money(preview?.subtotal)}</output>
                </div>
                {showDiscount && adjustment("discount", "Discount")}
                {showTax && adjustment("tax", "Tax")}
                {showShipping && moneyAdjustment("shipping", "Shipping")}
                {(!showDiscount || !showShipping || !showTax) && (
                  <div className="generator-add-adjustments">
                    {!showTax && (
                      <button
                        type="button"
                        data-add-adjustment="tax"
                        onClick={() => setShowTax(true)}
                      >
                        + Tax
                      </button>
                    )}
                    {!showDiscount && (
                      <button
                        type="button"
                        data-add-adjustment="discount"
                        onClick={() => setShowDiscount(true)}
                      >
                        + Discount
                      </button>
                    )}
                    {!showShipping && (
                      <button
                        type="button"
                        data-add-adjustment="shipping"
                        onClick={() => setShowShipping(true)}
                      >
                        + Shipping
                      </button>
                    )}
                  </div>
                )}
                <div className="generator-total-row generator-total-divider">
                  <strong>Total</strong>
                  <strong>{money(preview?.total)}</strong>
                </div>
                {moneyAdjustment("amountPaid", "Amount paid")}
                <div className="generator-total-row generator-balance">
                  <strong>Balance due</strong>
                  <strong>{money(preview?.balance)}</strong>
                </div>
                {totalError && <p role="alert">{totalError}</p>}
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    </>
  );
}
