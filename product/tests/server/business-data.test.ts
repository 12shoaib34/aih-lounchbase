import { expect, it } from "vitest";
import { businessInput } from "../../shared/business";
import { readContactCsv, writeContactCsv } from "../../shared/contact-csv";
it("rejects overlapping hours, invalid timezones and duplicate locations", () => {
  const location = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Main",
    address: "",
    hours: [{ day: 1, opens: "09:00", closes: "17:00" }],
  };
  const value = {
    name: "Business",
    email: "",
    phone: "",
    timezone: "UTC",
    currency: "USD",
    locale: "en",
    locations: [location],
  };
  expect(businessInput.safeParse(value).success).toBe(true);
  expect(
    businessInput.safeParse({ ...value, timezone: "invalid" }).success,
  ).toBe(false);
  expect(
    businessInput.safeParse({ ...value, locations: [location, location] })
      .success,
  ).toBe(false);
  const overlap = businessInput.safeParse({
    ...value,
    locations: [
      {
        ...location,
        hours: [
          ...location.hours,
          { day: 2, opens: "08:00", closes: "09:00" },
          { day: 3, opens: "12:00", closes: "14:00" },
          { day: 3, opens: "13:00", closes: "17:00" },
        ],
      },
    ],
  });
  expect(overlap.error?.issues.map((issue) => issue.path)).toEqual([
    ["locations", 0, "hours", 2, "opens"],
    ["locations", 0, "hours", 3, "opens"],
  ]);
});
it("parses quoted multiline CSV with mapping and rejects duplicates and malformed rows", () => {
  const parsed = readContactCsv(
    'Customer,notes\r\n"Ada, Example","line one\nline two"',
    { name: "Customer" },
  );
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows[0]).toMatchObject({
    name: "Ada, Example",
    notes: "line one\nline two",
  });
  expect(readContactCsv("name\nAda\nAda").errors).not.toHaveLength(0);
  expect(readContactCsv("name,email\nAda,invalid").errors).not.toHaveLength(0);
  expect(readContactCsv('name,email\n"broken').errors).not.toHaveLength(0);
});
it("escapes spreadsheet formula fields on export", () => {
  const csv = writeContactCsv([
    {
      name: "=HYPERLINK(1)",
      email: "",
      phone: "+123",
      company: "",
      notes: "",
      tags: ["lead"],
      status: "active",
    },
  ]);
  expect(csv).toContain("'=HYPERLINK(1)");
  expect(csv).toContain("'+123");
});
it("normalizes older business settings and validates profile and stored invoice preferences", () => {
  const old = {
    name: "Example",
    email: "",
    phone: "",
    timezone: "UTC",
    currency: "USD",
    locale: "en",
    locations: [],
  };
  const data = businessInput.parse(old);
  expect(data.address).toEqual({
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "",
  });
  expect(data.invoiceDefaults).toEqual({
    currency: "",
    dueDays: null,
    paymentInstructions: "",
    notes: "",
    terms: "",
  });
  expect(data.logo).toBe("");
  expect(
    businessInput.safeParse({ ...old, website: "javascript:alert(1)" }).success,
  ).toBe(false);
  expect(
    businessInput.safeParse({ ...old, website: "https://example.com" }).success,
  ).toBe(true);
  expect(
    businessInput.safeParse({
      ...old,
      logo: "data:image/png;base64,bm90YW5pbWFnZQ==",
    }).success,
  ).toBe(false);
  expect(
    businessInput.safeParse({
      ...old,
      logo: "data:image/svg+xml;base64,PHN2Zy8+",
    }).success,
  ).toBe(false);
  for (const dueDays of [-1, 366, 1.5])
    expect(
      businessInput.safeParse({ ...old, invoiceDefaults: { dueDays } }).success,
    ).toBe(false);
  expect(
    businessInput.safeParse({ ...old, invoiceDefaults: { currency: "ZZZ" } })
      .success,
  ).toBe(false);
  expect(
    businessInput.safeParse({ ...old, address: { extra: "no" } }).success,
  ).toBe(false);
  expect(
    businessInput.parse({
      ...old,
      invoiceDefaults: { dueDays: 0, currency: "EUR" },
    }).invoiceDefaults.dueDays,
  ).toBe(0);
});
