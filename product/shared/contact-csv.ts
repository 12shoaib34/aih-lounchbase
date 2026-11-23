import type { z } from "zod";
import Papa from "papaparse";
import { contactInput, type ContactInput } from "./contacts";
export const contactColumns = [
  "name",
  "email",
  "phone",
  "company",
  "legalName",
  "billingAddress",
  "notes",
  "tags",
  "status",
] as const;
const versionColumn = "launchbase_csv_version";
// Include a literal apostrophe so decoding a protected cell is reversible.
const protectedPrefix = /^['=+@\-\t\r\n]/;

export function readContactCsv(
  source: string,
  mapping: Record<string, string> = {},
) {
  const parsed = Papa.parse<Record<string, string>>(source, {
    header: true,
    delimiter: ",",
    skipEmptyLines: "greedy",
  });
  const fields = parsed.meta.fields ?? [];
  const versioned = fields.includes(versionColumn);
  const headers = fields.filter(
    (field) => field !== versionColumn && field !== "",
  );
  const errors: string[] = [];
  if (
    parsed.errors.length ||
    (parsed.meta.renamedHeaders &&
      Object.keys(parsed.meta.renamedHeaders).length)
  )
    errors.push(
      "Invalid CSV quoting, duplicate headers, or inconsistent columns.",
    );
  if (!parsed.data.length || parsed.data.length > 500)
    errors.push("Import between 1 and 500 contacts at a time.");
  if (!headers.includes(mapping.name ?? "name"))
    errors.push("Map a column to the contact name.");
  const rows: ContactInput[] = [];
  const seen = new Set<string>();
  if (errors.length) return { headers, rows, errors };
  parsed.data.forEach((row, index) => {
    if (versioned && row[versionColumn] !== "1") {
      errors.push(`Row ${index + 2}: unsupported contact CSV version.`);
      return;
    }
    const value = (key: string) => {
      const column = mapping[key] ?? key;
      if (!column || column === versionColumn || !Object.hasOwn(row, column))
        return "";
      const raw = row[column] ?? "";
      return versioned &&
        raw.startsWith("'") &&
        protectedPrefix.test(raw.slice(1))
        ? raw.slice(1)
        : raw;
    };
    const tagCell = value("tags");
    let tags: unknown;
    if (versioned && (mapping.tags ?? "tags") === "tags" && tagCell) {
      try {
        tags = JSON.parse(tagCell);
      } catch {
        errors.push(`Row ${index + 2}: invalid tags array.`);
        return;
      }
    } else {
      tags = tagCell
        .split("|")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    const result = contactInput.safeParse({
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      company: value("company"),
      legalName: value("legalName"),
      billingAddress: value("billingAddress"),
      notes: value("notes"),
      tags,
      status: value("status") || "active",
    });
    if (!result.success)
      errors.push(`Row ${index + 2}: ${result.error.issues[0].message}`);
    else {
      const key = JSON.stringify(result.data);
      if (seen.has(key))
        errors.push(`Row ${index + 2}: duplicate row in this file.`);
      seen.add(key);
      rows.push(result.data);
    }
  });
  return { headers, rows, errors };
}
export function writeContactCsv(rows: z.input<typeof contactInput>[]) {
  return Papa.unparse(
    {
      fields: [...contactColumns, versionColumn],
      data: rows.map((input) => {
        const row = contactInput.parse(input);
        return [
          ...contactColumns.map((key) =>
            key === "tags" ? JSON.stringify(row.tags) : row[key],
          ),
          "1",
        ];
      }),
    },
    { escapeFormulae: protectedPrefix },
  );
}
