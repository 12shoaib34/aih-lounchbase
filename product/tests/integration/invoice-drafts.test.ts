import { newInvoiceDocument } from "../../shared/invoiceDefaults";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { it, expect } from "vitest";
import app from "../../server/index";

it("guards invoice detail and draft edits with permissions, version locks and atomic audit", async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  const suffix = randomUUID();
  const emails = ["owner", "staff", "customer"].map(
    (role) => `invoice-${role}-${suffix}@example.com`,
  );
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const base = "http://localhost:8787";
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_BASE_URL: base,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
  };
  const [originalSettings] =
    await sql`SELECT data, version, updated_by, updated_at FROM business_settings WHERE singleton`;
  let settingsChanged = false;
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
    const businessData = {
      name: "Prefilled business",
      legalName: "Prefilled Ltd",
      email: "prefill@example.com",
      phone: "+44 123",
      website: "https://example.com",
      registrationNumber: "REG-123",
      taxId: "TAX-456",
      address: { line1: "Original address", country: "United Kingdom" },
      timezone: "UTC",
      currency: "GBP",
      locale: "en",
      locations: [],
      invoiceDefaults: {
        currency: "EUR",
        dueDays: 30,
        notes: "Original note",
        paymentInstructions: "Bank reference",
        terms: "Net 30 terms",
      },
    };
    const savedSettings = await request(
      "/api/business",
      owner.cookie,
      { data: businessData, version: originalSettings?.version ?? 0 },
      "PUT",
    );
    expect(savedSettings.status).toBe(200);
    settingsChanged = true;
    const settings = await savedSettings.json();
    const defaults = await (
      await request("/api/billing/defaults", owner.cookie)
    ).json();
    expect(defaults).toMatchObject({
      currency: "EUR",
      sellerName: "Prefilled business",
      dueDays: 30,
      notes: "Original note",
    });
    expect(defaults.sellerAddress).toContain("Tax ID: TAX-456");
    expect(defaults).not.toHaveProperty("locations");
    await grant(["billing:read", "billing:create"]);
    expect((await request("/api/business", staff.cookie)).status).toBe(403);
    expect(
      await (await request("/api/billing/defaults", staff.cookie)).json(),
    ).toEqual(defaults);
    await grant([]);
    expect((await request("/api/billing/defaults", staff.cookie)).status).toBe(
      403,
    );
    const prefilledId = randomUUID();
    ids.push(prefilledId);
    const prefilled = {
      currency: defaults.currency,
      items: [{ description: "Service", quantity: 1, unitAmount: 1000 }],
      document: {
        ...newInvoiceDocument(defaults),
        billToName: "Prefill recipient",
        notes: "Invoice-only override",
      },
    };
    expect(
      (
        await request("/api/billing", owner.cookie, {
          id: prefilledId,
          data: prefilled,
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request("/api/business", owner.cookie)).json()).data
        .invoiceDefaults.notes,
    ).toBe("Original note");
    const stored = await (
      await request(`/api/billing/${prefilledId}`, owner.cookie)
    ).json();
    expect(stored.document).toEqual(prefilled.document);
    expect(
      (
        await request(
          "/api/business",
          owner.cookie,
          {
            data: {
              ...businessData,
              name: "Changed business",
              logo: "",
              invoiceDefaults: {
                ...businessData.invoiceDefaults,
                notes: "Changed note",
              },
            },
            version: settings.version,
          },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await (
          await request(`/api/billing/${prefilledId}`, owner.cookie)
        ).json()
      ).document,
    ).toEqual(stored.document);
    expect(
      (
        await request(`/api/billing/${prefilledId}/action`, owner.cookie, {
          action: "issue",
          version: stored.version,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await (
          await request(`/api/billing/${prefilledId}`, owner.cookie)
        ).json()
      ).document,
    ).toEqual(stored.document);
    expect(
      (await (await request("/api/billing/defaults", owner.cookie)).json())
        .sellerName,
    ).toBe("Changed business");
    const data = {
      customerId: customer.id,
      currency: "USD",
      items: [
        { description: "Design", quantity: 2, unitAmount: 1250 },
        { description: "Handover", quantity: 1, unitAmount: 500 },
      ],
      document: {
        sellerName: "Example studio",
        sellerAddress: "1 Example Road",
        sellerEmail: "studio@example.test",
        billToName: "Client company",
        billToAddress: "2 Client Road",
        invoiceDate: "2026-11-13",
        dueDate: "2026-11-20",
        terms: "Pay by the due date.",
      },
    };
    const standaloneId = randomUUID();
    ids.push(standaloneId);
    const standalone = {
      ...data,
      customerId: null,
      document: { ...data.document, billToEmail: "recipient@example.test" },
    };
    for (let retry = 0; retry < 2; retry++)
      expect(
        (
          await request("/api/billing", owner.cookie, {
            id: standaloneId,
            data: standalone,
          })
        ).status,
      ).toBe(200);
    const standalonePath = `/api/billing/${standaloneId}`;
    const savedStandalone = await (
      await request(standalonePath, owner.cookie)
    ).json();
    expect((await request("/api/billing/list", customer.cookie)).status).toBe(
      403,
    );
    expect(
      (await request("/api/billing/defaults", customer.cookie)).status,
    ).toBe(403);
    expect(
      (await request("/api/billing/list?page=0", owner.cookie)).status,
    ).toBe(400);
    const history = await (
      await request(
        "/api/billing/list?search=recipient%40example.test&status=draft",
        owner.cookie,
      )
    ).json();
    expect(history).toMatchObject({ total: 1, page: 1, pageSize: 20 });
    expect(history.items[0]).toMatchObject({
      id: standaloneId,
      recipient: "Client company",
      total: 3000,
      balance: 3000,
      invoiceDate: "2026-11-13",
    });
    expect(history.items[0]).not.toHaveProperty("document");
    expect(
      (
        await (
          await request("/api/billing/list?search=%25", owner.cookie)
        ).json()
      ).total,
    ).toBe(0);
    expect(
      (
        await (
          await request(
            "/api/billing/list?page=2&search=recipient%40example.test",
            owner.cookie,
          )
        ).json()
      ).items,
    ).toEqual([]);
    expect((await request("/api/billing/defaults", owner.cookie)).status).toBe(
      200,
    );
    expect(savedStandalone.customerId).toBeNull();
    expect(savedStandalone.customerName).toBe("Client company");
    expect(savedStandalone.document.billToEmail).toBe("recipient@example.test");
    expect(
      (
        await request(
          standalonePath,
          owner.cookie,
          { version: 1, data: standalone },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect((await request(standalonePath, customer.cookie)).status).toBe(403);
    const path = `/api/billing/${ids[0]}`;
    expect((await request(path)).status).toBe(401);
    expect(
      (await request("/api/billing", owner.cookie, { id: ids[0], data }))
        .status,
    ).toBe(200);
    expect(
      (await request("/api/billing", owner.cookie, { id: ids[0], data }))
        .status,
    ).toBe(200);
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM admin_audit_events WHERE target_id=${ids[0]} AND action='invoice.created'`
      )[0].n,
    ).toBe(1);
    expect((await request(path, customer.cookie)).status).toBe(403);
    await grant(["billing:read"]);
    const initial = await (await request(path, staff.cookie)).json();
    expect(initial.amount).toBe(3000);
    expect(initial.document).toMatchObject(data.document);
    expect((await request("/api/billing/not-an-id", staff.cookie)).status).toBe(
      404,
    );
    expect(
      (await request(`/api/billing/${randomUUID()}`, staff.cookie)).status,
    ).toBe(404);
    expect((await request("/api/billing/review", staff.cookie)).status).toBe(
      403,
    );
    const changed = {
      ...data,
      items: [{ description: "Revised", quantity: 3, unitAmount: 1000 }],
    };
    expect(
      (await request(path, staff.cookie, { version: 1, data: changed }, "PUT"))
        .status,
    ).toBe(403);
    await grant(["billing:read", "billing:create"]);
    expect(
      (await request(path, staff.cookie, { version: 1, data: changed }, "PUT"))
        .status,
    ).toBe(403);
    await grant(["billing:read", "billing:edit"]);
    expect(
      (await request("/api/billing", staff.cookie, { id: ids[1], data }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(path + "/action", staff.cookie, {
          version: 1,
          action: "issue",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/admin/account-choices?purpose=billing",
          staff.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          path,
          staff.cookie,
          {
            version: 1,
            data: {
              ...changed,
              document: { ...data.document, dueDate: "2026-11-01" },
            },
          },
          "PUT",
        )
      ).status,
    ).toBe(400);
    const results = await Promise.all(
      [changed, { ...changed, currency: "JPY" }].map((data) =>
        request(path, staff.cookie, { version: 1, data }, "PUT"),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const current = await (await request(path, owner.cookie)).json();
    expect(current.version).toBe(2);
    expect(current.document).toMatchObject(data.document);
    expect(
      (
        await sql`SELECT count(*)::int AS n FROM admin_audit_events WHERE target_id=${ids[0]} AND action='invoice.updated'`
      )[0].n,
    ).toBe(1);
    expect(
      (await request(path, staff.cookie, { version: 1, data }, "PUT")).status,
    ).toBe(409);
    expect(
      (
        await request(
          path,
          staff.cookie,
          { version: 2, data: { ...changed, customerId: "missing" } },
          "PUT",
        )
      ).status,
    ).toBe(400);
    // Fail only this fixture's audit write; invoice update must roll back with it.
    await sql.unsafe(
      `CREATE FUNCTION invoice_draft_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'invoice.updated' AND NEW.target_id = '${ids[0]}' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`,
    );
    await sql`CREATE TRIGGER invoice_draft_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION invoice_draft_audit_failure()`;
    try {
      expect(
        (await request(path, staff.cookie, { version: 2, data }, "PUT")).status,
      ).toBe(500);
      expect((await (await request(path, staff.cookie)).json()).version).toBe(
        2,
      );
    } finally {
      await sql`DROP TRIGGER invoice_draft_audit_failure ON admin_audit_events`;
      await sql`DROP FUNCTION invoice_draft_audit_failure()`;
    }
    const race = await Promise.all([
      request(path, staff.cookie, { version: 2, data }, "PUT"),
      request(path + "/action", owner.cookie, { version: 2, action: "issue" }),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
    let latest = await (await request(path, owner.cookie)).json();
    if (latest.status === "draft") {
      expect(
        (
          await request(path + "/action", owner.cookie, {
            version: latest.version,
            action: "issue",
          })
        ).status,
      ).toBe(200);
      latest = await (await request(path, owner.cookie)).json();
    }
    expect(
      (
        await request(
          path,
          staff.cookie,
          { version: latest.version, data: changed },
          "PUT",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await (await request("/api/billing?scope=mine", customer.cookie)).json()
      ).items.map((v: { id: string }) => v.id),
    ).toContain(ids[0]);
    // Adjustments are authoritative and amount-paid is separately privileged.
    const adjusted = {
      ...data,
      document: {
        ...data.document,
        discount: "10",
        tax: "5",
        shipping: "2",
        amountPaid: "5",
      },
    };
    expect(
      (
        await request(`/api/billing`, staff.cookie, {
          id: randomUUID(),
          data: adjusted,
        })
      ).status,
    ).toBe(403);
    const adjustedId = randomUUID();
    ids.push(adjustedId);
    expect(
      (
        await request("/api/billing", owner.cookie, {
          id: adjustedId,
          data: adjusted,
        })
      ).status,
    ).toBe(200);
    const adjustedRecord = await (
      await request(`/api/billing/${adjustedId}`, owner.cookie)
    ).json();
    expect(adjustedRecord.amount).toBe(2535);
    await grant(["billing:read", "billing:edit"]);
    expect(
      (
        await request(
          `/api/billing/${adjustedId}`,
          staff.cookie,
          {
            version: 1,
            data: {
              ...adjusted,
              document: { ...adjusted.document, amountPaid: "6" },
            },
          },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/billing/${adjustedId}`,
          staff.cookie,
          {
            version: 1,
            data: {
              ...adjusted,
              currency: "JPY",
              document: { ...adjusted.document, amountPaid: "500" },
            },
          },
          "PUT",
        )
      ).status,
    ).toBe(403);
    const freeId = randomUUID();
    ids.push(freeId);
    expect(
      (
        await request("/api/billing", owner.cookie, {
          id: freeId,
          data: { ...data, document: { ...data.document, discount: "100" } },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/billing/${freeId}/action`, owner.cookie, {
          action: "issue",
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request(`/api/billing/${freeId}`, owner.cookie)).json())
        .status,
    ).toBe("paid");

    // A checkout attempt always blocks editing, even on an anomalous draft row.
    expect(
      (await request("/api/billing", owner.cookie, { id: ids[1], data }))
        .status,
    ).toBe(200);
    await sql`UPDATE billing_invoices SET checkout_attempt_at=now(), checkout_attempt_token=${randomUUID()} WHERE id=${ids[1]}`;
    expect(
      (
        await request(
          `/api/billing/${ids[1]}`,
          staff.cookie,
          { version: 1, data: changed },
          "PUT",
        )
      ).status,
    ).toBe(409);
    for (const [index, status] of [
      [2, "paid"],
      [3, "void"],
    ] as const) {
      expect(
        (await request("/api/billing", owner.cookie, { id: ids[index], data }))
          .status,
      ).toBe(200);
      await sql`UPDATE billing_invoices SET status=${status} WHERE id=${ids[index]}`;
      expect(
        (
          await request(
            `/api/billing/${ids[index]}`,
            staff.cookie,
            { version: 1, data: changed },
            "PUT",
          )
        ).status,
      ).toBe(409);
    }
    for (const status of ["paid", "void"]) {
      const list = await (
        await request(`/api/billing/list?status=${status}`, owner.cookie)
      ).json();
      expect(
        list.items.every((row: { balance: number }) => row.balance === 0),
      ).toBe(true);
    }
    const batch = Array.from({ length: 21 }, () => randomUUID());
    ids.push(...batch);
    for (const id of batch) {
      await sql`INSERT INTO billing_invoices (id,customer_name,currency,amount,items,document) VALUES (${id},${suffix},'USD',3000,${sql.json(data.items)},${sql.json({ ...data.document, reference: suffix })})`;
    }
    const first = await (
      await request(`/api/billing/list?search=${suffix}`, owner.cookie)
    ).json();
    const second = await (
      await request(`/api/billing/list?search=${suffix}&page=2`, owner.cookie)
    ).json();
    expect(first.total).toBe(21);
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(1);
    expect(
      new Set(
        [...first.items, ...second.items].map((row: { id: string }) => row.id),
      ).size,
    ).toBe(21);
    await grant(["billing:edit"]);
    expect((await request(path, staff.cookie)).status).toBe(403);
    expect(
      (
        await request(
          path,
          staff.cookie,
          { version: latest.version, data },
          "PUT",
        )
      ).status,
    ).toBe(403);
  } finally {
    if (settingsChanged) {
      if (originalSettings)
        await sql`UPDATE business_settings SET data = ${sql.json(originalSettings.data)}, version = ${originalSettings.version}, updated_by = ${originalSettings.updated_by}, updated_at = ${originalSettings.updated_at} WHERE singleton`;
      else await sql`DELETE FROM business_settings`;
    }
    await sql`DELETE FROM billing_invoices WHERE id IN ${sql(ids)}`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email IN ${sql(emails)})`;
    await sql`DELETE FROM "user" WHERE email IN ${sql(emails)}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient IN ${sql(emails)}`;
    await sql.end();
  }
}, 30000);
