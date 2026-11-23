import { expect, it } from "vitest";
import { contactInput, contactInvoiceRecipient } from "../../shared/contacts";
import { readContactCsv, writeContactCsv } from "../../shared/contact-csv";
it("normalizes legacy contacts and preserves multiline billing fields in CSV", () => {
  const legacy = {
    name: "Jane",
    email: "jane@example.com",
    phone: "123",
    company: "Studio",
    notes: "Private",
    tags: [],
    status: "active" as const,
  };
  expect(contactInput.parse(legacy)).toMatchObject({
    legalName: "",
    billingAddress: "",
  });
  const data = {
    ...legacy,
    legalName: 'Studio "Limited"',
    billingAddress: "10 Road, Suite 2\nLondon\nUK",
  };
  const parsed = readContactCsv(writeContactCsv([data]));
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toEqual([data]);
  expect(readContactCsv(writeContactCsv([legacy])).rows[0].billingAddress).toBe(
    "",
  );
  expect(
    contactInput.safeParse({ ...data, billingAddress: "x".repeat(501) })
      .success,
  ).toBe(false);
});
it("round-trips protected text and delimiter-containing tags at contact field limits", () => {
  for (const prefix of ["=", "+", "-", "@", "'", "''", "'=", "'+"]) {
    const data = {
      name: prefix.padEnd(120, "n"),
      phone: "+".padEnd(40, "9"),
      company: "'Example",
      legalName: "@Example",
      email: "",
      billingAddress: 'Address, with quotes "and"\r\nline two',
      notes: (prefix + "line one\n").padEnd(4000, "x"),
      tags: Array.from({ length: 20 }, (_, i) => `tag${i}|"\\`.padEnd(40, "x")),
      status: "archived" as const,
    };
    const csv = writeContactCsv([data]);
    expect(csv).toContain("'" + data.notes);
    expect(readContactCsv(csv)).toMatchObject({ rows: [data], errors: [] });
  }
});
it("preserves unmarked CSV text and distinguishes skipped columns from automatic mapping", () => {
  const source =
    "name,phone,notes,email,tags,status\nAda,'+123,private,invalid,one|two,archived";
  const mapping = { notes: "", email: "", status: "" };
  expect(readContactCsv(source, mapping)).toMatchObject({
    errors: [],
    rows: [
      {
        name: "Ada",
        phone: "'+123",
        notes: "",
        email: "",
        tags: ["one", "two"],
        status: "active",
      },
    ],
  });
  expect(readContactCsv(source, { ...mapping, name: "" }).errors).toContain(
    "Map a column to the contact name.",
  );
  expect(
    readContactCsv("name,tags,launchbase_csv_version\nAda,malformed,1").errors,
  ).toHaveLength(1);
  expect(
    readContactCsv("name,tags,launchbase_csv_version\nAda,[],2").errors,
  ).toHaveLength(1);
});
it("copies recipient fields only, with legal/company/name fallbacks", () => {
  const contact = {
    id: "id",
    name: "Jane",
    company: "Studio",
    legalName: "Studio Ltd",
    billingAddress: "Road\nCity",
    email: "jane@example.com",
  };
  expect(contactInvoiceRecipient(contact)).toEqual({
    billToName: "Studio Ltd",
    billToAddress: "Road\nCity",
    billToEmail: "jane@example.com",
  });
  expect(
    contactInvoiceRecipient({ ...contact, legalName: "" }).billToName,
  ).toBe("Studio");
  expect(
    contactInvoiceRecipient({ ...contact, legalName: "", company: "" })
      .billToName,
  ).toBe("Jane");
});
