import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { it, expect } from "vitest";
import app from "../../server/index";
import { readContactCsv } from "../../shared/contact-csv";
import { contactInvoiceRecipient } from "../../shared/contacts";
it("guards contact choices, preserves legacy retries and invoice snapshots", async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  const suffix = randomUUID();
  const emails = ["owner", "staff", "customer"].map(
    (role) => `invoice-${role}-${suffix}@example.com`,
  );
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const base = "http://localhost:8787";
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_BASE_URL: base,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
  };
  let ip = 0;
  const request = (
    path: string,
    cookie = "",
    data?: object,
    method = data ? "POST" : "GET",
  ) =>
    app.request(
      path.startsWith("http") ? path : base + path,
      {
        method,
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
          "cf-connecting-ip": `fd12:${suffix.slice(0, 4)}:${(++ip).toString(16)}::1`,
        },
        body: data ? JSON.stringify(data) : undefined,
      },
      env,
    );
  async function register(email: string) {
    const password = "A long invoice review password 123!";
    expect(
      (
        await request("/api/auth/sign-up/email", "", {
          email,
          password,
          name: "Invoice reviewer",
        })
      ).status,
    ).toBe(200);
    const [mail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${email} ORDER BY id DESC LIMIT 1`;
    await request(mail.url);
    const login = await request("/api/auth/sign-in/email", "", {
      email,
      password,
    });
    expect(login.status).toBe(200);
    const [user] = await sql`SELECT id FROM "user" WHERE email=${email}`;
    return {
      id: user.id as string,
      cookie: login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
  try {
    const owner = await register(emails[0]);
    const staff = await register(emails[1]);
    const customer = await register(emails[2]);
    await sql`INSERT INTO team_members (user_id,role) VALUES (${owner.id},'owner'),(${staff.id},'staff')`;
    const grant = async (permissions: string[]) => {
      await sql`DELETE FROM user_permissions WHERE user_id=${staff.id}`;
      for (const permission of permissions)
        await sql`INSERT INTO user_permissions (user_id,permission) VALUES (${staff.id},${permission})`;
    };
    const legacy = {
      name: suffix,
      email: emails[2],
      company: "Example",
      phone: "555-987-123",
      notes: "Private note",
      tags: ["private"],
      status: "active",
    };
    await sql`INSERT INTO contacts (id,data) VALUES (${ids[0]},${sql.json(legacy)})`;
    expect(
      (
        await request("/api/contacts", owner.cookie, {
          id: ids[0],
          data: legacy,
        })
      ).status,
    ).toBe(200);
    expect(
      await (
        await request("/api/contacts/import", owner.cookie, {
          items: [{ id: ids[0], data: legacy }],
        })
      ).json(),
    ).toEqual({ inserted: 0, unchanged: 1 });
    const data = {
      ...legacy,
      phone: "+923001234567",
      tags: ["sales|priority"],
      notes: "'private",
      legalName: `Legal ${suffix}`,
      billingAddress: "Road\nCity",
    };
    expect(
      (await request("/api/contacts", owner.cookie, { id: ids[1], data }))
        .status,
    ).toBe(201);
    expect(
      (
        await request("/api/contacts", owner.cookie, {
          id: ids[2],
          data: { ...data, status: "archived" },
        })
      ).status,
    ).toBe(201);
    const exported = await request("/api/contacts/export", owner.cookie);
    expect(exported.status).toBe(200);
    const csv = readContactCsv(await exported.text());
    expect(csv.errors).toEqual([]);
    const copied = csv.rows.find(
      (row) => row.legalName === data.legalName && row.status === "archived",
    );
    expect(copied).toEqual({ ...data, status: "archived" });
    expect(
      await (
        await request("/api/contacts/import", owner.cookie, {
          items: [{ id: ids[4], data: copied }],
        })
      ).json(),
    ).toEqual({ inserted: 1, unchanged: 0 });
    const [stored] = await sql`SELECT data FROM contacts WHERE id=${ids[4]}`;
    expect(stored.data).toEqual(copied);
    const choices = "/api/contacts/invoice-choices";
    expect((await request(choices)).status).toBe(401);
    expect((await request(choices, customer.cookie)).status).toBe(403);
    for (const permissions of [
      ["contacts:read"],
      ["billing:read", "billing:create"],
      ["contacts:read", "billing:create"],
    ]) {
      await grant(permissions);
      expect((await request(choices, staff.cookie)).status).toBe(403);
    }
    await grant(["contacts:read", "billing:read", "billing:create"]);
    for (const search of [data.legalName, data.phone]) {
      const found = await (
        await request(
          choices + "?search=" + encodeURIComponent(search),
          staff.cookie,
        )
      ).json();
      expect(found.items.map((item: { id: string }) => item.id)).toContain(
        ids[1],
      );
      expect(found.items.map((item: { id: string }) => item.id)).not.toContain(
        ids[2],
      );
      for (const item of found.items)
        expect(Object.keys(item).sort()).toEqual(
          [
            "id",
            "name",
            "company",
            "legalName",
            "email",
            "billingAddress",
          ].sort(),
        );
      const list = await (
        await request(
          "/api/contacts?search=" + encodeURIComponent(search),
          owner.cookie,
        )
      ).json();
      expect(list.items.map((item: { id: string }) => item.id)).toContain(
        ids[1],
      );
    }
    expect(
      (await (await request(choices + "?search=%25", owner.cookie)).json())
        .items,
    ).toEqual([]);
    expect(
      (await request(choices + "?search=" + "x".repeat(101), owner.cookie))
        .status,
    ).toBe(400);
    const recipient = contactInvoiceRecipient({ id: ids[1], ...data });
    expect(
      (
        await request("/api/billing", owner.cookie, {
          id: ids[3],
          data: {
            currency: "USD",
            items: [{ description: "Service", quantity: 1, unitAmount: 1000 }],
            document: {
              sellerName: "Seller",
              invoiceDate: "2026-11-15",
              ...recipient,
            },
          },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/api/contacts/" + ids[1],
          owner.cookie,
          { version: 1, data: { ...data, billingAddress: "Changed" } },
          "PUT",
        )
      ).status,
    ).toBe(200);
    const invoice = await (
      await request("/api/billing/" + ids[3], owner.cookie)
    ).json();
    expect(invoice.customerId).toBeNull();
    expect(invoice.document).toMatchObject(recipient);
  } finally {
    await sql`DELETE FROM billing_invoices WHERE id=${ids[3]}`;
    await sql`DELETE FROM contacts WHERE id IN ${sql(ids)}`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email IN ${sql(emails)})`;
    await sql`DELETE FROM "user" WHERE email IN ${sql(emails)}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient IN ${sql(emails)}`;
    await sql.end();
  }
}, 30000);
