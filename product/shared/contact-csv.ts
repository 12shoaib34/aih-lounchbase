import type { z } from "zod";
import Papa from "papaparse";
import { contactInput, type ContactInput } from "./contacts";
const formatColumn = "launchbase_csv_version";
const formulaOrQuote = /^['=+@\-\t\r]/;

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
export function readContactCsv(
  source: string,
  mapping: Record<string, string> = {},
) {
  const parsed = Papa.parse<Record<string, string>>(source, {
    header: true,
    delimiter: ",",
    skipEmptyLines: "greedy",
  });
  const headers = parsed.meta.fields ?? [];
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
    const exported = row[formatColumn] === "1";
    const value = (key: string) => {
      const column = mapping[key] ?? key;
      const text = column ? (row[column] ?? "") : "";
      return exported &&
        text.startsWith("'") &&
        formulaOrQuote.test(text.slice(1))
        ? text.slice(1)
        : text;
    };
    const tagCell = value("tags");
    let tags: unknown;
    if (exported && tagCell) {
      try {
        tags = JSON.parse(tagCell);
      } catch {
        errors.push(`Row ${index + 2}: invalid exported tags.`);
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
      fields: [...contactColumns, formatColumn],
      data: rows.map((input) => {
        const row = contactInput.parse(input);
        return [
          ...contactColumns.map((key) => {
            const text = key === "tags" ? JSON.stringify(row.tags) : row[key];
            return formulaOrQuote.test(text) ? "'" + text : text;
          }),
          "1",
        ];
      }),
    },
    { escapeFormulae: true },
  );
}
