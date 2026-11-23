import {
  formatMoney,
  invoiceTotals,
  invoiceLineAmount,
  type InvoiceDocument,
} from "../../../shared/billing";

export type PrintableInvoice = {
  number: string;
  currency: string;
  status: string;
  items: { description: string; quantity: number; unitAmount: number }[];
  document: InvoiceDocument;
};
export function invoicePdfData(invoice: PrintableInvoice) {
  const d = invoice.document;
  const totals = invoiceTotals(invoice);
  const money = (value: number) => {
    const formatted = formatMoney(value, invoice.currency, "en-US");
    return invoice.currency === "USD"
      ? formatted.replace("$", "US$")
      : formatted;
  };
  const date = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
  const paid = invoice.status === "paid" ? totals.total : totals.amountPaid;
  const balance = invoice.status === "void" ? 0 : totals.total - paid;
  const hasAdjustments = !!(totals.discount || totals.tax || totals.shipping);
  const summary = [
    ...(hasAdjustments ? [["Subtotal", money(totals.subtotal)]] : []),
    ...(totals.discount
      ? [
          [
            `Discount${d.discountMode === "percent" ? ` (${d.discount}%)` : ""}`,
            `−${money(totals.discount)}`,
          ],
        ]
      : []),
    ...(totals.tax
      ? [
          [
            `Tax${d.taxMode === "percent" ? ` (${d.tax}%)` : ""}`,
            money(totals.tax),
          ],
        ]
      : []),
    ...(totals.shipping ? [["Shipping", money(totals.shipping)]] : []),
    ["Total", money(totals.total)],
    ...(paid ? [["Amount paid", money(paid)]] : []),
    ["Balance due", money(balance)],
  ];
  const metadata = [
    ...(d.invoiceDate ? [["Invoice date", date(d.invoiceDate)]] : []),
    ...(d.dueDate ? [["Due date", date(d.dueDate)]] : []),
    ...(d.paymentTerms ? [["Payment terms", d.paymentTerms]] : []),
    ...(d.purchaseOrder ? [["PO number", d.purchaseOrder]] : []),
  ];
  return {
    title: d.title,
    reference: d.reference || invoice.number,
    sellerName: d.sellerName,
    logo: d.logo,
    parties: [
      {
        label: "From",
        name: d.sellerName,
        details: [d.sellerAddress, d.sellerEmail].filter(Boolean),
      },
      {
        label: "Bill to",
        name: d.billToName,
        details: [d.billToAddress, d.billToEmail].filter(Boolean),
      },
      ...(d.shipTo
        ? [{ label: "Ship to", name: "", details: [d.shipTo] }]
        : []),
    ],
    metadata,
    items: invoice.items.map((item) => [
      item.description,
      String(item.quantity),
      money(item.unitAmount),
      money(invoiceLineAmount(item)),
    ]),
    summary,
    notes: d.notes,
    terms: d.terms,
    status:
      invoice.status === "draft"
        ? "Draft — not issued."
        : invoice.status === "void"
          ? "VOID"
          : "",
  };
}
