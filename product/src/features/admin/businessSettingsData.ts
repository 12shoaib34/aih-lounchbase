import { businessInput, type Business } from "../../../shared/business";

export const emptyBusiness: Business = {
  ...businessInput.parse({
    name: "Business",
    email: "",
    phone: "",
    timezone: "UTC",
    currency: "USD",
    locale: "en",
    locations: [],
  }),
  name: "",
};

export const businessSections = {
  profile: "Business profile",
  regional: "Regional preferences",
  invoices: "Invoice preferences",
  locations: "Locations & hours",
};
export type BusinessSection = keyof typeof businessSections;
export function sectionFor(path: string): BusinessSection {
  const key = path.split(".")[0];
  if (key === "locations") return "locations";
  if (key === "invoiceDefaults") return "invoices";
  if (["timezone", "currency", "locale"].includes(key)) return "regional";
  return "profile";
}

export function changedSections(before: Business, after: Business) {
  return new Set(
    (Object.keys(before) as (keyof Business)[])
      .filter(
        (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
      )
      .map(sectionFor),
  );
}

export function validationErrors(draft: Business) {
  const errors: Record<string, string> = {};
  const parsed = businessInput.safeParse(draft);
  if (!parsed.success)
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".")] ??= issue.message;
    }
  return errors;
}
