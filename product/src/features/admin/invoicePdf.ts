import type { PrintableInvoice } from "./invoicePdfData";
export type { PrintableInvoice } from "./invoicePdfData";

async function invoiceBlob(invoice: PrintableInvoice, print = false) {
  const { renderInvoicePdf } = await import("./taggedInvoicePdf");
  const regularUrl = "/product/fonts/Roboto-Regular.ttf";
  const boldUrl = "/product/fonts/Roboto-Medium.ttf";
  const fonts = await Promise.all(
    [regularUrl, boldUrl].map(async (url) => {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error("Could not load invoice fonts. Try again.");
      return new Uint8Array(await response.arrayBuffer());
    }),
  );
  const bytes = await renderInvoicePdf(
    invoice,
    { regular: fonts[0], bold: fonts[1] },
    { print },
  );
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}

export async function downloadInvoice(invoice: PrintableInvoice) {
  const url = URL.createObjectURL(await invoiceBlob(invoice));
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${(invoice.document.reference || invoice.number).replace(/[^a-zA-Z0-9_-]/g, "-") || "draft"}.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  // Allow the browser to consume the download before releasing its bytes.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function printInvoice(
  invoice: PrintableInvoice,
  printWindow: Window,
) {
  const url = URL.createObjectURL(await invoiceBlob(invoice, true));
  try {
    if (printWindow.closed)
      throw new Error("The print window was closed. Try again.");
    printWindow.location.href = url;
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  // Keep the URL alive while the viewer loads; its document owns the loaded data.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
