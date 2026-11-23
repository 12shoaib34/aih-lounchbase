import { test, expect } from "@playwright/test";
import { readContactCsv, writeContactCsv } from "../product/shared/contact-csv";
test("spreadsheet-safe export preserves contact values and explicit blank mappings", () => {
  const row = {
    name: "=" + "x".repeat(119),
    company: "'Example",
    email: "hello@example.invalid",
    phone: "+923001234567",
    legalName: "@account",
    billingAddress: "-line",
    notes: "'".repeat(4000),
    tags: ["sales|priority", "renewal"],
    status: "active" as const,
  };
  const csv = writeContactCsv([row]);
  expect(csv).toContain("'=x");
  expect(readContactCsv(csv)).toMatchObject({ errors: [], rows: [row] });
  expect(readContactCsv(csv, { notes: "", email: "", tags: "" }).rows).toEqual([
    { ...row, notes: "", email: "", tags: [] },
  ]);
  expect(readContactCsv("name,tags\nTest,one|two").rows[0].tags).toEqual([
    "one",
    "two",
  ]);
});
