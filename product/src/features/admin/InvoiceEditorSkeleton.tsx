import { useLocation } from "@/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/TextAreaField";

/** Public document geometry only; never mounts editor state or protected defaults. */
export function InvoiceEditorSkeleton({
  mode = "new",
}: {
  mode?: "new" | "edit";
}) {
  const title = mode === "edit" ? "Edit draft" : "New invoice";
  const { search } = useLocation();
  return (
    <section aria-busy="true" aria-label="Preparing invoice">
      <span role="status" className="sr-only">
        Preparing invoice…
      </span>
      <form
        className="invoice-editor invoice-editor-loading"
        inert
        aria-hidden="true"
      >
        <PageHeader
          title={title}
          description={
            mode === "edit" ? (
              <span className="invoice-loading-value" />
            ) : undefined
          }
          breadcrumbs={
            <Breadcrumbs
              items={[
                { label: "Billing", to: `/admin/billing${search}` },
                { label: title },
              ]}
            />
          }
          actions={
            <>
              <span className="page-header-cancel">Cancel</span>
              <Button
                variant="secondary"
                className="generator-download"
                type="button"
              >
                Download PDF
              </Button>
              <Button type="button">Save draft</Button>
            </>
          }
        />
        <div className="generator-layout">
          <aside className="generator-sidebar">
            <div className="invoice-command-bar">
              <div className="field">
                <label>Currency</label>
                <select aria-label="Currency">
                  <option>USD</option>
                </select>
              </div>
              <Button variant="secondary" type="button">
                Options
              </Button>
            </div>
          </aside>
          <fieldset className="generator-paper">
            <div className="generator-heading">
              <div className="generator-logo">
                <div className="generator-logo-upload" />
              </div>
              <div className="generator-number">
                <Field label="Document title" value="INVOICE" readOnly />
                <Field label="Invoice number" value="" readOnly />
              </div>
            </div>
            <div className="generator-parties">
              <div className="generator-addresses">
                <div className="generator-seller">
                  <TextAreaField
                    label="Seller name"
                    rows={3}
                    autoGrow
                    value=""
                    readOnly
                  />
                </div>
                <div className="generator-recipients">
                  <TextAreaField label="Bill to" rows={3} value="" readOnly />
                  <TextAreaField label="Ship to" rows={3} value="" readOnly />
                </div>
                <Field label="Customer email" value="" readOnly />
              </div>
              <div className="generator-metadata">
                <Field label="Date" type="date" value="" readOnly />
                <Field label="Payment terms" value="" readOnly />
                <Field label="Due date" type="date" value="" readOnly />
                <Field label="PO number" value="" readOnly />
              </div>
            </div>
            <section>
              <div className="generator-item-head">
                <span>Item</span>
                <span>Quantity</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
              <fieldset className="invoice-item generator-item">
                <Field
                  id="item-loading"
                  label="Item description"
                  value=""
                  readOnly
                />
                <Field label="Quantity" value="" readOnly />
                <div className="generator-rate">
                  <Field label="Rate" value="" readOnly />
                </div>
                <div className="invoice-item-total">
                  <span className="invoice-loading-value" />
                </div>
                <div className="generator-item-actions">
                  <button
                    className="generator-drag-handle"
                    type="button"
                    disabled
                  />
                </div>
              </fieldset>
              <Button variant="secondary" type="button">
                + Line item
              </Button>
            </section>
            <div className="generator-bottom">
              <div className="generator-notes">
                <TextAreaField
                  label="Notes"
                  rows={3}
                  autoGrow
                  value=""
                  readOnly
                />
                <TextAreaField
                  label="Terms"
                  rows={3}
                  autoGrow
                  value=""
                  readOnly
                />
              </div>
              <div className="generator-totals">
                <div className="generator-total-row">
                  <span>Subtotal</span>
                  <output>
                    <span className="invoice-loading-value" />
                  </output>
                </div>
                <div className="generator-adjustment">
                  <span className="generator-adjustment-label">Tax</span>
                  <div className="generator-adjustment-controls is-percent">
                    <span className="generator-adjustment-unit">%</span>
                    <Field label="Tax" value="" readOnly />
                    <button type="button" className="generator-mode-toggle">
                      ⇄
                    </button>
                  </div>
                  <button type="button" className="generator-remove-adjustment">
                    ×
                  </button>
                </div>
                <div className="generator-add-adjustments">
                  <button type="button">+ Discount</button>
                  <button type="button">+ Shipping</button>
                </div>
                <div className="generator-total-row generator-total-divider">
                  <strong>Total</strong>
                  <strong>
                    <span className="invoice-loading-value" />
                  </strong>
                </div>
                <div className="generator-adjustment">
                  <span className="generator-adjustment-label">
                    Amount paid
                  </span>
                  <div className="generator-money-control">
                    <Field label="Amount paid" value="" readOnly />
                  </div>
                </div>
                <div className="generator-total-row generator-balance">
                  <strong>Balance due</strong>
                  <strong>
                    <span className="invoice-loading-value" />
                  </strong>
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </form>
    </section>
  );
}
