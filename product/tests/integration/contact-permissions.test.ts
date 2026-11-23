import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { it, expect } from "vitest";
import app from "../../server/index";

it("delegates contact read/write/import/export independently and revokes access in the existing session", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated test database required.");
  const sql = postgres(process.env.DATABASE_URL);
  const suffix = randomUUID();
  const emails = [
    `contact-owner-${suffix}@example.com`,
    `contact-staff-${suffix}@example.com`,
    `contact-customer-${suffix}@example.com`,
  ];
  const base = "http://localhost:8787";
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_BASE_URL: base,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
    TEAM_INVITES_ENABLED: "true",
  };
  let ip = 0;
  const request = (
    path: string,
    cookie = "",
    body?: object,
    method = body ? "POST" : "GET",
    bindings = env,
  ) =>
    app.request(
      path.startsWith("http") ? path : base + path,
      {
        method,
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
          "cf-connecting-ip": `fd${suffix.slice(0, 2)}:${suffix.slice(2, 6)}:${suffix.slice(9, 13)}:${(++ip).toString(16)}::1`,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      bindings,
    );
  async function register(email: string) {
    const password = "A long audit test password 123!";
    expect(
      (
        await request("/api/auth/sign-up/email", "", {
          email,
          password,
          name: "Audit tester",
        })
      ).status,
    ).toBe(200);
    const [mail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${email} ORDER BY id DESC LIMIT 1`;
    expect((await request(mail.url)).status).toBe(302);
    const login = await request("/api/auth/sign-in/email", "", {
      email,
      password,
    });
    expect(login.status).toBe(200);
    const [user] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
    return {
      id: user.id as string,
      cookie: login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
  const contactId = randomUUID();
  const importId = randomUUID();
  try {
    const owner = await register(emails[0]);
    const staff = await register(emails[1]);

    const customer = await register(emails[2]);
    await sql`INSERT INTO team_members (user_id, role) VALUES (${owner.id}, 'owner')`;
    const data = {
      name: `Delegated ${suffix} %_\\ marker`,
      email: "",
      phone: "",
      company: "",
      legalName: "",
      billingAddress: "",
      notes: "Private note available to authorized readers",
      tags: [],
      status: "active",
    };
    expect(
      (await request("/api/contacts", owner.cookie, { id: contactId, data }))
        .status,
    ).toBe(201);
    expect((await request("/api/contacts")).status).toBe(401);
    expect((await request(`/api/contacts/${contactId}`)).status).toBe(401);
    expect(
      await (await request(`/api/contacts/${contactId}`, owner.cookie)).json(),
    ).toEqual({ id: contactId, data, version: 1 });
    // Search characters remain literal when read queries reuse the auth pool.
    for (const search of [`%${suffix}`, `${suffix}_`]) {
      const result = await (
        await request(
          `/api/contacts?search=${encodeURIComponent(search)}`,
          owner.cookie,
        )
      ).json();
      expect(result).toMatchObject({ items: [], total: 0, page: 1 });
    }
    const literalSearch = encodeURIComponent(`${suffix} %_\\ marker`);
    const found = await (
      await request(`/api/contacts?search=${literalSearch}`, owner.cookie)
    ).json();
    expect(found.total).toBe(1);
    expect(found.items).toEqual([{ id: contactId, data, version: 1 }]);
    const beyond = await (
      await request(
        `/api/contacts?search=${literalSearch}&page=2`,
        owner.cookie,
      )
    ).json();
    expect(beyond).toMatchObject({ items: [], total: 1, page: 2 });
    for (const id of ["not-a-uuid", randomUUID()])
      expect((await request(`/api/contacts/${id}`, owner.cookie)).status).toBe(
        404,
      );
    // Permission rows without team membership never grant business access.
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${customer.id}, 'contacts:read')`;
    expect((await request("/api/contacts", customer.cookie)).status).toBe(403);
    expect(
      (await request(`/api/contacts/${contactId}`, customer.cookie)).status,
    ).toBe(403);
    for (const permissions of [
      ["contacts:write"],
      ["contacts:export"],
      ["contacts:import"],
      ["team:manage"],
      ["contacts:unknown"],
      ["contacts:read", "contacts:read"],
    ]) {
      expect(
        (
          await request("/api/team/invitations", owner.cookie, {
            email: emails[1],
            permissions,
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (
        await request("/api/team/invitations", owner.cookie, {
          email: emails[1],
          permissions: ["contacts:read"],
        })
      ).status,
    ).toBe(201);
    const [inviteMail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${emails[1]} AND subject = 'Join your team' ORDER BY id DESC LIMIT 1`;
    expect(
      (
        await request("/api/team/accept", staff.cookie, {
          token: new URL(inviteMail.url).hash.slice(1),
        })
      ).status,
    ).toBe(200);
    expect(
      (await (await request("/api/contacts", staff.cookie)).json()).items.find(
        (row: { id: string }) => row.id === contactId,
      ).data.notes,
    ).toBe(data.notes);
    expect(
      await (await request(`/api/contacts/${contactId}`, staff.cookie)).json(),
    ).toEqual({ id: contactId, data, version: 1 });
    const importBody = {
      items: [{ id: importId, data: { ...data, name: "Imported by staff" } }],
    };
    expect(
      (await request("/api/contacts", staff.cookie, { id: randomUUID(), data }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          staff.cookie,
          { data, version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/contacts/import", staff.cookie, importBody)).status,
    ).toBe(403);
    expect((await request("/api/contacts/export", staff.cookie)).status).toBe(
      403,
    );
    for (const path of [
      "/api/team",
      "/api/audit",
      "/api/business",
      "/api/files",
      "/api/notification-jobs",
      "/api/billing/review",
    ]) {
      expect((await request(path, staff.cookie)).status).toBe(403);
    }
    const grants = (version: number, permissions: string[]) =>
      request(
        `/api/team/members/${staff.id}`,
        owner.cookie,
        { version, permissions },
        "PUT",
      );
    expect((await grants(1, ["contacts:write"])).status).toBe(400);
    expect((await grants(1, ["contacts:read", "contacts:write"])).status).toBe(
      200,
    );
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          staff.cookie,
          { data: { ...data, status: "archived" }, version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("/api/contacts/import", staff.cookie, importBody)).status,
    ).toBe(403);
    expect((await request("/api/contacts/export", staff.cookie)).status).toBe(
      403,
    );
    expect((await grants(2, ["contacts:read", "contacts:import"])).status).toBe(
      200,
    );
    expect(
      await (await request(`/api/contacts/${contactId}`, staff.cookie)).json(),
    ).toEqual({
      id: contactId,
      data: { ...data, status: "archived" },
      version: 2,
    });
    expect(
      (await request("/api/contacts", staff.cookie, { id: randomUUID(), data }))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          staff.cookie,
          { data, version: 2 },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      await (
        await request("/api/contacts/import", staff.cookie, importBody)
      ).json(),
    ).toEqual({ inserted: 1, unchanged: 0 });
    expect(
      await (
        await request("/api/contacts/import", staff.cookie, importBody)
      ).json(),
    ).toEqual({ inserted: 0, unchanged: 1 });
    expect((await request("/api/contacts/export", staff.cookie)).status).toBe(
      403,
    );
    expect((await grants(3, ["contacts:read", "contacts:export"])).status).toBe(
      200,
    );
    const csv = await request("/api/contacts/export", staff.cookie);
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain(data.notes);
    expect(
      (await request("/api/contacts/import", staff.cookie, importBody)).status,
    ).toBe(403);
    const all = [
      "users:read",
      "records:read:any",
      "contacts:read",
      "contacts:write",
      "contacts:import",
      "contacts:export",
    ];
    expect((await grants(4, all)).status).toBe(200);
    expect((await grants(4, [])).status).toBe(409);
    expect(
      (
        await request(
          `/api/team/members/${staff.id}`,
          staff.cookie,
          { version: 5, permissions: all },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await sql`SELECT after_permissions FROM admin_audit_events WHERE target_id = ${staff.id} AND action = 'member.permissions_changed' ORDER BY id DESC LIMIT 1`
      )[0].after_permissions,
    ).toEqual(all);
    const events =
      await sql`SELECT action, actor_id FROM admin_audit_events WHERE target_id IN (${contactId}, ${importId}) ORDER BY id`;
    expect(events).toEqual([
      { action: "contact.created", actor_id: owner.id },
      { action: "contact.updated", actor_id: staff.id },
      { action: "contact.imported", actor_id: staff.id },
    ]);
    expect((await grants(5, [])).status).toBe(200);
    for (const path of [
      "/api/contacts",
      "/api/contacts/export",
      `/api/contacts/${contactId}`,
    ])
      expect((await request(path, staff.cookie)).status).toBe(403);
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          staff.cookie,
          { data, version: 2 },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/contacts/import", staff.cookie, importBody)).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/team/members/${staff.id}`,
          owner.cookie,
          { version: 6 },
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect((await request("/api/admin", staff.cookie)).status).toBe(403);
    expect((await request("/api/auth/get-session", staff.cookie)).status).toBe(
      200,
    );
    expect((await request("/api/contacts", owner.cookie)).status).toBe(200);
  } finally {
    await sql`DELETE FROM contacts WHERE id IN (${contactId}, ${importId})`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY(${emails}))`;
    await sql`DELETE FROM "user" WHERE email = ANY(${emails})`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ANY(${emails})`;
    await sql.end();
  }
}, 30000);
