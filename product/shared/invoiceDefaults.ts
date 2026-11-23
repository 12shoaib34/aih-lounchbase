import { businessInput } from "./business";
import { invoiceDefaultsSchema, invoiceDocument } from "./billing";
import type { z } from "zod";

/** Project only customer-facing details, never locations/hours or private settings. */
export function businessInvoiceDefaults(value: unknown) {
  const business = value === null ? null : businessInput.parse(value);
  const preferences = business?.invoiceDefaults;
  const address = business
    ? [
        business.address.line1,
        business.address.line2,
        business.address.city,
        business.address.region,
        business.address.postalCode,
        business.address.country,
      ]
        .filter(Boolean)
        .join("\n") ||
      (business.locations.length === 1 ? business.locations[0].address : "")
    : "";
  const dueDays = preferences?.dueDays ?? null;
  return invoiceDefaultsSchema.parse({
    currency: preferences?.currency || business?.currency || "USD",
    sellerName: business?.name || "",
    sellerEmail: business?.email || "",
    sellerAddress: business
      ? [
          business.legalName !== business.name ? business.legalName : "",
          address,
          business.phone ? `Phone: ${business.phone}` : "",
          business.website,
          business.registrationNumber
            ? `Registration: ${business.registrationNumber}`
            : "",
          business.taxId ? `Tax ID: ${business.taxId}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    logo: business?.logo || "",
    notes: preferences?.notes || "",
    terms: [
      preferences?.paymentInstructions
        ? `Payment instructions\n${preferences.paymentInstructions}`
        : "",
      preferences?.terms ? `Terms\n${preferences.terms}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    paymentTerms:
      dueDays === null
        ? ""
        : dueDays === 0
          ? "Due on receipt"
          : `Net ${dueDays}`,
    dueDays,
    timezone: business?.timezone || "UTC",
  });
}

/** Called once for a new editor, never to refresh saved or recovered documents. */
export function newInvoiceDocument(
  defaults?: z.infer<typeof invoiceDefaultsSchema>,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: defaults?.timezone ?? "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)!.value;
  const invoiceDate = `${part("year")}-${part("month")}-${part("day")}`;
  const dueDays = defaults?.dueDays;
  const due = new Date(`${invoiceDate}T00:00:00Z`);
  if (dueDays != null) due.setUTCDate(due.getUTCDate() + dueDays);
  return invoiceDocument.parse({
    sellerName: defaults?.sellerName,
    sellerEmail: defaults?.sellerEmail,
    sellerAddress: defaults?.sellerAddress,
    logo: defaults?.logo,
    notes: defaults?.notes,
    terms: defaults?.terms,
    paymentTerms: defaults?.paymentTerms,
    invoiceDate,
    dueDate: dueDays == null ? "" : due.toISOString().slice(0, 10),
  });
}
