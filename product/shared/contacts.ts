import { z } from "zod";
export const contactListQuery = z.object({
  search: z.string().trim().max(100).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  status: z.enum(["active", "archived", "all"]).default("active"),
});
export const contactInput = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z.string().trim().max(40),
  company: z.string().trim().max(120),
  legalName: z.string().trim().max(120).default(""),
  billingAddress: z.string().trim().max(500).default(""),
  notes: z.string().trim().max(4000),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(20)
    .transform((tags) => [...new Set(tags)]),
  status: z.enum(["active", "archived"]),
});
export const contactSchema = z.object({
  id: z.uuid(),
  data: contactInput,
  version: z.number().int().positive(),
});
export const contactsPageSchema = z.object({
  items: z.array(contactSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
});
export type ContactInput = z.infer<typeof contactInput>;
export type Contact = z.infer<typeof contactSchema>;

// Invoice choices deliberately omit private notes, tags and account identities.
export const contactBillingChoiceSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  company: z.string(),
  legalName: z.string(),
  email: z.string(),
  billingAddress: z.string(),
});
export const contactBillingChoicesSchema = z.object({
  items: z.array(contactBillingChoiceSchema),
});
export type ContactBillingChoice = z.infer<typeof contactBillingChoiceSchema>;
export function contactInvoiceRecipient(contact: ContactBillingChoice) {
  return {
    billToName: (contact.legalName || contact.company || contact.name).replace(
      /[\r\n]+/g,
      " ",
    ),
    billToAddress: contact.billingAddress,
    billToEmail: contact.email,
  };
}
