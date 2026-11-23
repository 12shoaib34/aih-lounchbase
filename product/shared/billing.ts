import { z } from "zod";
import { businessInput } from "./business";
const date = z.union([z.literal(""), z.iso.date()]);
export const invoiceDocument = z
  .object({
    title: z.string().trim().min(1).max(60).default("INVOICE"),
    reference: z.string().trim().max(60).default(""),
    shipTo: z.string().trim().max(500).default(""),
    paymentTerms: z.string().trim().max(120).default(""),
    purchaseOrder: z.string().trim().max(120).default(""),
    notes: z.string().trim().max(2000).default(""),
    logo: z
      .string()
      .max(350000)
      .regex(/^(?:|data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+)$/)
      .default(""),
    tax: z.string().max(20).default("0"),
    taxMode: z.enum(["percent", "flat"]).default("percent"),
    discount: z.string().max(20).default("0"),
    discountMode: z.enum(["percent", "flat"]).default("percent"),
    shipping: z.string().max(20).default("0"),
    amountPaid: z.string().max(20).default("0"),
    sellerName: z.string().trim().max(120).default(""),
    sellerAddress: z.string().trim().max(2000).default(""),
    sellerEmail: z.union([z.literal(""), z.email().max(254)]).default(""),
    billToName: z.string().trim().max(120).default(""),
    billToEmail: z
      .string()
      .trim()
      .pipe(z.union([z.literal(""), z.email().max(254)]))
      .default(""),
    billToAddress: z.string().trim().max(500).default(""),
    invoiceDate: date.default(""),
    dueDate: date.default(""),
    terms: z.string().trim().max(4000).default(""),
  })
  .refine(
    (value) =>
      !value.dueDate ||
      !value.invoiceDate ||
      value.dueDate >= value.invoiceDate,
    {
      message: "Due date must be on or after the invoice date.",
      path: ["dueDate"],
    },
  );
export type InvoiceDocument = z.infer<typeof invoiceDocument>;
export const invoiceInput = z
  .object({
    customerId: z.string().min(1).max(128).nullable().default(null),
    document: invoiceDocument.prefault({}),
    currency: businessInput.shape.currency,
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(160),
          quantity: z.number().min(0.001).max(1000).multipleOf(0.001),
          unitAmount: z.number().int().min(0).max(100000000),
        }),
      )
      .min(1)
      .max(30),
  })
  .superRefine((value, context) => {
    if (!value.customerId && !value.document.billToName)
      context.addIssue({
        code: "custom",
        path: ["document", "billToName"],
        message: "Enter the billing name.",
      });
    try {
      invoiceTotals(value);
    } catch (failure) {
      context.addIssue({ code: "custom", message: (failure as Error).message });
    }
  });

export function invoiceLineAmount(item: {
  quantity: number;
  unitAmount: number;
}) {
  return Math.round(
    (Math.round(item.quantity * 1000) * item.unitAmount) / 1000,
  );
}
export function parseInvoicePrice(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  if (
    new RegExp(`^0+(?:\\.0{1,${Math.max(1, digits)}})?$`).test(value) &&
    (digits > 0 || !value.includes("."))
  )
    return 0;
  return parsePrice(value, currency);
}
export function invoiceTotals(value: {
  currency: string;
  items: { quantity: number; unitAmount: number }[];
  document: InvoiceDocument;
}) {
  const money = (text: string) => {
    if (!text || /^0+(?:\.0+)?$/.test(text)) return 0;
    return parsePrice(text, value.currency);
  };
  const adjustment = (text: string, mode: "percent" | "flat", base: number) => {
    if (mode === "flat") return money(text);
    if (!/^\d+(?:\.\d{1,2})?$/.test(text || "0") || Number(text) > 100)
      throw new Error(
        "Percentages must be between 0 and 100, with up to two decimals.",
      );
    return Math.round((base * Math.round(Number(text) * 100)) / 10000);
  };
  const subtotal = value.items.reduce(
    (sum, item) => sum + invoiceLineAmount(item),
    0,
  );
  if (!Number.isSafeInteger(subtotal) || subtotal > 2000000000)
    throw new Error("Invoice subtotal is too large.");
  const discount = adjustment(
    value.document.discount,
    value.document.discountMode,
    subtotal,
  );
  if (discount > subtotal)
    throw new Error("Discount cannot exceed the subtotal.");
  const tax = adjustment(
    value.document.tax,
    value.document.taxMode,
    subtotal - discount,
  );
  const shipping = money(value.document.shipping);
  const total = subtotal - discount + tax + shipping;
  const amountPaid = money(value.document.amountPaid);
  if (amountPaid > total)
    throw new Error("Amount paid cannot exceed the invoice total.");
  if (!Number.isSafeInteger(total) || total > 2000000000)
    throw new Error("Invoice total is too large.");
  return {
    subtotal,
    discount,
    tax,
    shipping,
    total,
    amountPaid,
    balance: total - amountPaid,
  };
}

export const invoiceSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  customerName: z.string(),
  currency: z.string(),
  amount: z.number().int(),
  status: z.enum(["draft", "issued", "paid", "void"]),
  version: z.number().int(),
  paymentSource: z.string().nullable(),
  paymentReference: z.string().nullable(),
  items: invoiceInput.shape.items,
});
export const invoiceDetailsSchema = invoiceSchema.extend({
  customerId: z.string().nullable(),
  document: invoiceDocument.prefault({}),
  checkout: z.boolean().default(false),
});
export type InvoiceDetails = z.infer<typeof invoiceDetailsSchema>;
export const invoiceDraftUpdate = z.object({
  version: z.number().int().positive(),
  data: invoiceInput,
});
export const invoicesSchema = z.object({
  checkout: z.boolean(),
  items: z.array(invoiceSchema),
});
export function formatMoney(amount: number, currency: string, locale?: string) {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  });
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amount / 10 ** digits);
}
export function parsePrice(value: string, currency: string) {
  const digits =
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2;
  if (
    !new RegExp(`^\\d+(?:\\.\\d{1,${Math.max(1, digits)}})?$`).test(value) ||
    (digits === 0 && value.includes("."))
  )
    throw new Error("Enter a valid price for this currency.");
  const [whole, fraction = ""] = value.split(".");
  const amount =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 100000000)
    throw new Error("Price is outside the supported range.");
  return amount;
}

export const paymentReviewSchema = z.object({
  canAcknowledge: z.boolean(),
  canReconcile: z.boolean(),
  recoveries: z.array(
    z.object({
      invoiceId: z.uuid(),
      sessionId: z.string(),
      generation: z.number().int(),
      recoveredAt: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      id: z.string(),
      invoiceId: z.string().nullable(),
      outcome: z.enum(["review", "applied", "ignored"]),
      acknowledgedAt: z.string().nullable(),
      acknowledgedBy: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  attempts: z.array(
    z.object({
      id: z.uuid(),
      number: z.string(),
      attemptedAt: z.string(),
      canLinkSession: z.boolean(),
      version: z.number().int(),
      sessionId: z.string().nullable(),
    }),
  ),
});

export const invoiceListQuery = z.object({
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "draft", "issued", "paid", "void"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const invoiceListSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  items: z.array(
    z.object({
      id: z.uuid(),
      reference: z.string(),
      recipient: z.string(),
      invoiceDate: z.string(),
      dueDate: z.string(),
      status: invoiceSchema.shape.status,
      currency: z.string(),
      total: z.number().int(),
      balance: z.number().int(),
    }),
  ),
});
export const invoiceDefaultsSchema = z.object({
  currency: businessInput.shape.currency,
  sellerName: z.string(),
  sellerEmail: z.string(),
  sellerAddress: z.string(),
  logo: invoiceDocument.shape.logo,
  notes: invoiceDocument.shape.notes,
  terms: invoiceDocument.shape.terms,
  paymentTerms: invoiceDocument.shape.paymentTerms,
  dueDays: z.number().int().min(0).max(365).nullable().default(null),
  timezone: businessInput.shape.timezone.default("UTC"),
});
