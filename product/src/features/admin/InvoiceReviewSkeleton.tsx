import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

/** Unknown saved fields are shapes, never fabricated document values. */
export function InvoiceReviewSkeleton() {
  return (
    <div className="invoice-review" aria-busy="true">
      <span role="status" className="sr-only">
        Loading invoice…
      </span>
      <PageHeader
        title="Invoice details"
        description={
          <span aria-hidden="true">
            <span className="invoice-loading-value" />{" "}
            <span className="billing-status">
              <span style={{ visibility: "hidden" }}>Status</span>
            </span>
          </span>
        }
        actions={
          <div
            className="invoice-review-tools invoice-actions skeleton-controls"
            inert
            aria-hidden="true"
          >
            <Button variant="secondary">Download PDF</Button>
            <a className="button button-secondary">Edit draft</a>
            <Button>Issue invoice</Button>
            <details className="invoice-more">
              <summary>
                More actions <span aria-hidden="true">⌄</span>
              </summary>
            </details>
          </div>
        }
      />
      <article className="invoice-sheet generator-saved" aria-hidden="true">
        <header className="invoice-sheet-heading">
          <div />
          <div className="generator-saved-title">
            <h2>
              <span className="invoice-loading-value" />
            </h2>
            <p>
              <span className="invoice-loading-value" />
            </p>
            <p className="invoice-status">
              <span className="invoice-loading-value" />
            </p>
          </div>
        </header>
        <div className="invoice-parties">
          {["From", "Bill to"].map((label) => (
            <section key={label}>
              <h3>{label}</h3>
              <strong>
                <span className="invoice-loading-value" />
              </strong>
            </section>
          ))}
        </div>
        <table className="invoice-lines">
          <thead>
            <tr>
              {["Description", "Quantity", "Unit price", "Amount"].map(
                (label) => (
                  <th key={label} scope="col">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <span className="invoice-loading-value" />
              </th>
              {["Quantity", "Unit price", "Amount"].map((label) => (
                <td key={label} data-label={label}>
                  <span className="invoice-loading-value" />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <dl className="generator-saved-totals">
          {[
            "Subtotal",
            "Discount",
            "Tax",
            "Shipping",
            "Total",
            "Amount paid",
            "Balance due",
          ].map((label) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>
                <span className="invoice-loading-value" />
              </dd>
            </div>
          ))}
        </dl>
      </article>
    </div>
  );
}
