import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { apiRequest, ApiError } from "@/api/client";
import {
  formatMoney,
  manualPaymentMethod,
  parsePrice,
  type InvoiceDetails,
} from "../../../shared/billing";

export function RecordPaymentDialog({
  invoice,
  onClose,
  onRecorded,
}: {
  invoice: InvoiceDetails;
  onClose: () => void;
  onRecorded: () => void;
}) {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency: invoice.currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  const [amount, setAmount] = useState(
    (invoice.amount / 10 ** digits).toFixed(digits),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toLocaleDateString("en-CA");
  return (
    <Dialog
      open
      title="Record payment"
      description={`Remaining balance: ${formatMoney(invoice.amount, invoice.currency)}. Enter a payment already received.`}
      onClose={() => {
        if (!pending) onClose();
      }}
      actions={null}
    >
      <form
        className="payment-fields"
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending) return;
          const data = new FormData(event.currentTarget);
          let received;
          try {
            received = parsePrice(amount, invoice.currency, invoice.amount);
          } catch {
            setError(
              "Enter a positive amount within the remaining balance using the invoice currency’s decimal places.",
            );
            return;
          }
          setPending(true);
          setError("");
          try {
            await apiRequest(`/billing/${invoice.id}/action`, {
              method: "POST",
              body: JSON.stringify({
                action: "record-payment",
                version: invoice.version,
                amount: received,
                date: data.get("date"),
                method: data.get("method"),
                reference: data.get("reference"),
              }),
            });
            onRecorded();
          } catch (failure) {
            setError(
              failure instanceof ApiError
                ? failure.message
                : "Payment could not be confirmed. Close and refresh the invoice before retrying.",
            );
            setPending(false);
          }
        }}
      >
        <Field
          label={`Amount (${invoice.currency})`}
          required
          inputMode="decimal"
          value={amount}
          disabled={pending}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Field
          label="Payment date"
          type="date"
          name="date"
          defaultValue={today}
          required
          disabled={pending}
        />
        <SelectField label="Payment method" name="method" disabled={pending}>
          {manualPaymentMethod.options.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </SelectField>
        <Field
          label="Payment reference"
          name="reference"
          maxLength={120}
          required
          pattern=".*\S.*"
          disabled={pending}
        />
        {error && <p role="alert">{error}</p>}
        <div className="dialog-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
