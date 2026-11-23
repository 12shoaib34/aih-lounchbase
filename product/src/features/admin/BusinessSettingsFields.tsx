import { useId, useRef, useState } from "react";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { businessLogo, type Business } from "../../../shared/business";

export function BusinessSectionNav({
  section = "profile",
  onChange,
}: {
  section?: string;
  onChange?: (section: string) => void;
}) {
  return (
    <nav
      className="business-section-nav"
      aria-label="Business settings sections"
    >
      {[
        ["profile", "Business profile"],
        ["regional", "Regional preferences"],
        ["invoices", "Invoice preferences"],
        ["locations", "Locations & hours"],
      ].map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant="secondary"
          aria-pressed={section === key}
          aria-controls={`business-panel-${key}`}
          onClick={() => onChange?.(key)}
        >
          {label}
        </Button>
      ))}
    </nav>
  );
}

type Props = {
  draft: Business;
  update: <K extends keyof Business>(key: K, value: Business[K]) => void;
  errors: Record<string, string>;
  disabled: boolean;
};

function BusinessLogo({
  value,
  onChange,
  disabled,
  onLoading,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  onLoading: (value: boolean) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [failure, setFailure] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <div className="business-logo">
      <div className="business-logo-preview">
        {value ? (
          <img src={value} alt="Business logo preview" />
        ) : (
          <span>No logo</span>
        )}
      </div>
      <div className="business-logo-controls">
        <div className="account-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || loading}
            onClick={() => input.current?.click()}
          >
            {loading
              ? "Processing logo…"
              : value
                ? "Replace logo"
                : "Upload logo"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || loading}
              onClick={() => {
                setFailure("");
                onChange("");
              }}
            >
              Remove logo
            </Button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-label="Business logo"
          aria-describedby={`${id}-help`}
          accept="image/png,image/jpeg"
          disabled={disabled || loading}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setFailure("");
            setLoading(true);
            onLoading(true);
            try {
              if (
                !["image/png", "image/jpeg"].includes(file.type) ||
                file.size > 2 * 1024 * 1024
              )
                throw new Error("Choose a PNG or JPEG under 2 MB.");
              const bitmap = await createImageBitmap(file);
              try {
                if (bitmap.width > 8000 || bitmap.height > 8000)
                  throw new Error(
                    "Choose an image smaller than 8000 pixels per side.",
                  );
                const scale = Math.min(
                  1,
                  600 / bitmap.width,
                  300 / bitmap.height,
                );
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(bitmap.width * scale));
                canvas.height = Math.max(1, Math.round(bitmap.height * scale));
                const context = canvas.getContext("2d");
                if (!context)
                  throw new Error(
                    "Could not process this image. Try another logo.",
                  );
                context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
                const logo = canvas.toDataURL("image/png");
                if (!businessLogo.safeParse(logo).success)
                  throw new Error(
                    "This logo is too detailed. Choose a smaller image.",
                  );
                onChange(logo);
              } finally {
                bitmap.close();
              }
            } catch (cause) {
              setFailure(
                cause instanceof Error
                  ? cause.message
                  : "Could not load this image. Try another logo.",
              );
            } finally {
              setLoading(false);
              onLoading(false);
              input.current?.parentElement
                ?.querySelector<HTMLButtonElement>("button")
                ?.focus();
            }
          }}
        />
        <p className="hint" id={`${id}-help`}>
          PNG or JPEG, up to 2 MB. Large images are resized.
        </p>
        {(failure || error) && (
          <p role="alert" className="field-error">
            {failure || error}
          </p>
        )}
        {loading && (
          <span className="sr-only" role="status">
            Processing business logo
          </span>
        )}
      </div>
    </div>
  );
}

export function BusinessProfileFields({
  draft,
  update,
  errors,
  disabled,
  onLogoLoading,
}: Props & { onLogoLoading: (loading: boolean) => void }) {
  const text = (
    key:
      | "name"
      | "legalName"
      | "registrationNumber"
      | "taxId"
      | "email"
      | "phone"
      | "website",
    label: string,
    maxLength: number,
    type = "text",
  ) => (
    <Field
      label={label}
      type={type}
      maxLength={maxLength}
      required={key === "name"}
      value={draft[key]}
      error={errors[key]}
      onChange={(event) => update(key, event.target.value)}
    />
  );
  return (
    <>
      <section className="business-section" aria-labelledby="business-identity">
        <h2 id="business-identity">Business identity</h2>
        <p className="hint">
          Use the name and logo customers recognize. Only the business name is
          required.
        </p>
        <BusinessLogo
          value={draft.logo}
          onChange={(logo) => update("logo", logo)}
          disabled={disabled}
          onLoading={onLogoLoading}
          error={errors.logo}
        />
        <fieldset
          disabled={disabled}
          className="business-fields business-profile-fields"
          aria-labelledby="business-identity"
        >
          {text("name", "Business name", 120)}
          {text("legalName", "Legal name (optional)", 120)}
          {text("registrationNumber", "Registration number (optional)", 100)}
          {text("taxId", "Tax ID (optional)", 100)}
        </fieldset>
      </section>
      <section className="business-section" aria-labelledby="business-address">
        <h2 id="business-address">Business address</h2>
        <p className="hint">
          Your main business address. Locations and opening hours are managed
          separately.
        </p>
        <fieldset
          disabled={disabled}
          className="business-fields business-profile-fields"
          aria-labelledby="business-address"
        >
          {(
            [
              ["line1", "Address line 1", 160],
              ["line2", "Address line 2 (optional)", 160],
              ["city", "City", 100],
              ["postalCode", "Postal code", 32],
              ["region", "Region / state", 100],
              ["country", "Country", 100],
            ] as const
          ).map(([key, label, maxLength]) => (
            <Field
              key={key}
              label={label}
              maxLength={maxLength}
              value={draft.address[key]}
              error={errors[`address.${key}`]}
              onChange={(event) =>
                update("address", {
                  ...draft.address,
                  [key]: event.target.value,
                })
              }
            />
          ))}
        </fieldset>
      </section>
      <section className="business-section" aria-labelledby="business-contact">
        <h2 id="business-contact">Business contact</h2>
        <fieldset
          disabled={disabled}
          className="business-fields business-profile-fields"
          aria-labelledby="business-contact"
        >
          {text("email", "Business email", 254, "email")}
          {text("phone", "Business phone", 40, "tel")}
          {text("website", "Website (optional)", 254, "url")}
        </fieldset>
      </section>
    </>
  );
}

export function BusinessInvoicePreferences({
  draft,
  update,
  errors,
  disabled,
}: Props) {
  const preferences = draft.invoiceDefaults;
  const change = <K extends keyof typeof preferences>(
    key: K,
    value: (typeof preferences)[K],
  ) => update("invoiceDefaults", { ...preferences, [key]: value });
  return (
    <>
      <p className="notice">
        Applied when you create a new invoice. You can edit them for that
        invoice without changing these settings. Saved invoices keep their own
        details.
      </p>
      <section
        className="business-section"
        aria-labelledby="business-invoice-payment"
      >
        <h2 id="business-invoice-payment">Payment preferences</h2>
        <fieldset
          disabled={disabled}
          className="business-fields business-profile-fields"
          aria-labelledby="business-invoice-payment"
        >
          <SelectField
            label="Preferred invoice currency"
            value={preferences.currency}
            error={errors["invoiceDefaults.currency"]}
            onChange={(event) => change("currency", event.target.value)}
          >
            <option value="">Use regional currency ({draft.currency})</option>
            {Intl.supportedValuesOf("currency").map((code) => (
              <option key={code}>{code}</option>
            ))}
          </SelectField>
          <Field
            label="Payment due after (days)"
            type="number"
            min={0}
            max={365}
            step={1}
            placeholder="No default"
            value={preferences.dueDays ?? ""}
            error={errors["invoiceDefaults.dueDays"]}
            onChange={(event) =>
              change(
                "dueDays",
                event.target.value === "" ? null : Number(event.target.value),
              )
            }
          />
        </fieldset>
        <p className="hint">
          0 means due on the invoice date. Leave blank for no default.
        </p>
      </section>
      <section
        className="business-section"
        aria-labelledby="business-invoice-copy"
      >
        <h2 id="business-invoice-copy">Payment instructions, notes & terms</h2>
        <p className="hint">
          Use the instructions and terms you normally share with customers.
        </p>
        <fieldset
          disabled={disabled}
          className="business-fields"
          aria-labelledby="business-invoice-copy"
        >
          {(
            [
              ["paymentInstructions", "Payment instructions", 2000],
              ["notes", "Default note", 2000],
              ["terms", "Default terms", 1000],
            ] as const
          ).map(([key, label, maxLength]) => (
            <TextAreaField
              key={key}
              label={label}
              rows={3}
              maxLength={maxLength}
              value={preferences[key]}
              error={errors[`invoiceDefaults.${key}`]}
              onChange={(event) => change(key, event.target.value)}
            />
          ))}
        </fieldset>
      </section>
    </>
  );
}
