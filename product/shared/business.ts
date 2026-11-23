import { z } from "zod";

const short = z.string().trim().max(160);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time.");
const hours = z
  .object({ day: z.number().int().min(0).max(6), opens: time, closes: time })
  .refine((value) => value.opens < value.closes, {
    message:
      "Closing time must follow opening time; split overnight hours across days.",
    path: ["closes"],
  });
const optionalText = (max: number) => z.string().trim().max(max).default("");
export const businessLogo = z
  .string()
  .max(350000)
  .refine((value) => {
    if (!value) return true;
    const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value,
    );
    if (!match) return false;
    try {
      const bytes = atob(match[2]);
      return match[1] === "png"
        ? bytes.startsWith("\x89PNG\r\n\x1a\n")
        : bytes.startsWith("\xff\xd8\xff");
    } catch {
      return false;
    }
  }, "Choose a PNG or JPEG logo under 350 KB after resizing.")
  .default("");
export const businessInput = z.strictObject({
  name: z.string().trim().min(1, "Enter your business name.").max(120),
  legalName: optionalText(120),
  registrationNumber: optionalText(100),
  taxId: optionalText(100),
  logo: businessLogo,
  website: z
    .union([z.literal(""), z.url({ protocol: /^https?$/ }).max(254)])
    .default(""),
  address: z
    .strictObject({
      line1: optionalText(160),
      line2: optionalText(160),
      city: optionalText(100),
      region: optionalText(100),
      postalCode: optionalText(32),
      country: optionalText(100),
    })
    .prefault({}),
  invoiceDefaults: z
    .strictObject({
      currency: z
        .union([
          z.literal(""),
          z
            .string()
            .refine(
              (value) => Intl.supportedValuesOf("currency").includes(value),
              "Choose a supported currency.",
            ),
        ])
        .default(""),
      dueDays: z.number().int().min(0).max(365).nullable().default(null),
      paymentInstructions: optionalText(2000),
      notes: optionalText(2000),
      terms: optionalText(1000),
    })
    .prefault({}),
  email: z.union([z.literal(""), z.email().max(254)]),
  phone: z.string().trim().max(40),
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid IANA timezone."),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .refine(
      (value) => Intl.supportedValuesOf("currency").includes(value),
      "Choose a supported currency.",
    ),
  locale: z
    .string()
    .min(2)
    .max(40)
    .refine((value) => {
      try {
        return Intl.DateTimeFormat.supportedLocalesOf([value]).length === 1;
      } catch {
        return false;
      }
    }, "Choose a supported locale."),
  locations: z
    .array(
      z.strictObject({
        id: z.uuid(),
        name: z.string().trim().min(1).max(100),
        address: short,
        hours: z
          .array(hours)
          .max(21)
          .superRefine((items, context) => {
            for (let i = 0; i < items.length; i++)
              for (let j = i + 1; j < items.length; j++)
                if (
                  items[i].day === items[j].day &&
                  items[i].opens < items[j].closes &&
                  items[j].opens < items[i].closes
                )
                  for (const index of [i, j])
                    context.addIssue({
                      code: "custom",
                      path: [index, "opens"],
                      message: "Opening periods must not overlap.",
                    });
          }),
      }),
    )
    .max(30)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
      "Location IDs must be unique.",
    ),
});
export const businessSchema = z.object({
  data: businessInput.nullable(),
  version: z.number().int().nonnegative(),
});
export const businessUpdate = z.object({
  data: businessInput,
  version: z.number().int().nonnegative(),
});
export type Business = z.infer<typeof businessInput>;
