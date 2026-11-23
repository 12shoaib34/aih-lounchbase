import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { it, expect, vi } from "vitest";
import { permissionDependencies, permissionSchema } from "../../shared/access";
import app from "../../server/index";

it("enforces independent module grants, customer ownership and same-session revocation", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated test database required.");
  const sql = postgres(process.env.DATABASE_URL);
  const suffix = randomUUID();
  const emails = [
    `module-owner-${suffix}@example.com`,
    `module-staff-${suffix}@example.com`,
    `module-customer-${suffix}@example.com`,
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
  const resourceId = randomUUID();
  const bookingId = randomUUID();
  const invoiceId = randomUUID();
  const jobId = randomUUID();
  const checkoutId = randomUUID();
  const voidId = randomUUID();
  try {
    const owner = await register(emails[0]);
    const staff = await register(emails[1]);
    const customer = await register(emails[2]);
    await sql`INSERT INTO team_members (user_id, role) VALUES (${owner.id}, 'owner'), (${staff.id}, 'staff')`;
    let version = 1;
    const grant = async (permissions: string[]) => {
      expect(
        (
          await request(
            `/api/team/members/${staff.id}`,
            owner.cookie,
            { version: version++, permissions },
            "PUT",
          )
        ).status,
      ).toBe(200);
    };
    // The owner-facing API must reject every action grant without its read prerequisite.
    for (const permission of Object.keys(permissionDependencies)) {
      expect(
        (
          await request(
            `/api/team/members/${staff.id}`,
            owner.cookie,
            { version, permissions: [permission] },
            "PUT",
          )
        ).status,
      ).toBe(400);
    }
    const reads = [
      "scheduling:read",
      "files:read",
      "notifications:read",
      "billing:read",
    ];
    await grant(reads);
    for (const path of [
      "/api/scheduling/bookings?scope=all",
      "/api/notification-jobs",
      "/api/notification-jobs/email-review",
      "/api/billing?scope=all",
    ]) {
      expect((await request(path, staff.cookie)).status).toBe(200);
      expect((await request(path, customer.cookie)).status).toBe(403);
    }
    for (const path of [
      "/api/business",
      "/api/team",
      "/api/audit",
      "/api/admin/users",
      "/api/billing/review",
      "/api/admin/account-choices?purpose=billing",
      "/api/admin/account-choices?purpose=notifications",
    ]) {
      expect((await request(path, staff.cookie)).status).toBe(403);
    }
    const resource = {
      id: resourceId,
      data: {
        name: "Delegated resource",
        timezone: "UTC",
        hours: [{ day: 1, opens: "00:00", closes: "23:59" }],
      },
    };
    expect(
      (await request("/api/scheduling/resources", staff.cookie, resource))
        .status,
    ).toBe(403);
    await grant([...reads, "scheduling:resources"]);
    expect(
      (await request("/api/scheduling/resources", staff.cookie, resource))
        .status,
    ).toBe(200);
    await sql`INSERT INTO bookings (id, resource_id, customer_id, starts_at, ends_at) VALUES (${bookingId}, ${resourceId}, ${customer.id}, now() + interval '1 day', now() + interval '2 days')`;
    expect(
      (
        await request(
          `/api/scheduling/bookings/${bookingId}/cancel`,
          staff.cookie,
          {},
        )
      ).status,
    ).toBe(404);
    await grant([...reads, "scheduling:cancel"]);
    expect(
      (
        await request(
          `/api/scheduling/bookings/${bookingId}/cancel`,
          staff.cookie,
          {},
        )
      ).status,
    ).toBe(204);
    // Resource creation does not follow from cancellation permission.
    expect(
      (await request("/api/scheduling/resources", staff.cookie, resource))
        .status,
    ).toBe(403);

    const invoice = {
      id: invoiceId,
      data: {
        customerId: customer.id,
        currency: "USD",
        items: [
          { description: "Permission fixture", quantity: 1, unitAmount: 1200 },
        ],
      },
    };
    expect((await request("/api/billing", staff.cookie, invoice)).status).toBe(
      403,
    );
    await grant([...reads, "billing:create"]);
    const lookup = await request(
      `/api/admin/account-choices?purpose=billing&search=${encodeURIComponent(emails[2])}`,
      staff.cookie,
    );
    expect(lookup.status).toBe(200);
    expect(await lookup.json()).toEqual({
      items: [{ id: customer.id, name: "Audit tester", email: emails[2] }],
    });
    expect(
      (
        await request(
          "/api/admin/account-choices?purpose=notifications",
          staff.cookie,
        )
      ).status,
    ).toBe(403);
    expect((await request("/api/billing", staff.cookie, invoice)).status).toBe(
      200,
    );
    expect(
      (await (await request("/api/billing?scope=mine", customer.cookie)).json())
        .items,
    ).toEqual([]);
    const action = (action: string, version: number) =>
      request(`/api/billing/${invoiceId}/action`, staff.cookie, {
        action,
        version,
        reference: "External receipt",
      });
    expect((await action("issue", 1)).status).toBe(403);
    await grant([...reads, "billing:issue"]);
    expect((await action("issue", 1)).status).toBe(200);
    expect(
      (
        await (await request("/api/billing?scope=mine", customer.cookie)).json()
      ).items.map((row: { id: string }) => row.id),
    ).toContain(invoiceId);
    expect(
      (await (await request("/api/billing", staff.cookie)).json()).items,
    ).toEqual([]);
    expect((await action("record-payment", 2)).status).toBe(403);
    expect((await action("void", 2)).status).toBe(403);
    await grant([...reads, "billing:record-payment"]);
    expect((await action("record-payment", 2)).status).toBe(200);
    expect((await request("/api/billing/review", staff.cookie)).status).toBe(
      403,
    );
    await grant([...reads, "billing:review"]);
    expect(
      (
        await request("/api/billing/review/acknowledge", staff.cookie, {
          eventId: "any-event",
        })
      ).status,
    ).toBe(403);
    expect((await request("/api/billing/review", staff.cookie)).status).toBe(
      200,
    );

    await grant([...reads, "billing:create", "billing:issue", "billing:void"]);
    for (const id of [checkoutId, voidId]) {
      expect(
        (await request("/api/billing", staff.cookie, { ...invoice, id }))
          .status,
      ).toBe(200);
      expect(
        (
          await request(`/api/billing/${id}/action`, staff.cookie, {
            action: "issue",
            version: 1,
          })
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await request(`/api/billing/${voidId}/action`, staff.cookie, {
          action: "void",
          version: 2,
        })
      ).status,
    ).toBe(200);
    const paymentEnv = {
      ...env,
      STRIPE_SECRET_KEY: ["sk", "test", randomUUID()].join("_"),
      STRIPE_WEBHOOK_SECRET: randomUUID(),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: `cs_${checkoutId}`,
          url: "https://checkout.stripe.com/test-staff",
          expires_at: Math.floor(Date.now() / 1000) + 1800,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    try {
      const checkout = (cookie: string) =>
        request(
          `/api/billing/${checkoutId}/checkout`,
          cookie,
          {},
          "POST",
          paymentEnv,
        );
      expect((await checkout(staff.cookie)).status).toBe(409);
      expect(fetchSpy).not.toHaveBeenCalled();
      await grant([...reads, "billing:checkout"]);
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              type: "invalid_request_error",
              code: "amount_too_small",
              message: "Fixture rejection",
            },
          }),
          {
            status: 400,
            headers: {
              "request-id": "req_fixture",
              "content-type": "application/json",
            },
          },
        ),
      );
      expect((await checkout(staff.cookie)).status).toBe(409);
      expect(
        (
          await sql`SELECT checkout_attempt_at, checkout_generation FROM billing_invoices WHERE id = ${checkoutId}`
        )[0],
      ).toMatchObject({ checkout_attempt_at: null, checkout_generation: 1 });
      expect((await checkout(staff.cookie)).status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      // Customer ownership remains valid without business-wide billing grants.
      expect((await checkout(customer.cookie)).status).toBe(200);
      await grant(reads);
      expect((await checkout(staff.cookie)).status).toBe(409);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }

    const job = {
      id: jobId,
      recipientId: customer.id,
      title: "Delegated message",
      body: "Private message",
      dueAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(
      (await request("/api/notification-jobs", staff.cookie, job)).status,
    ).toBe(403);
    await grant([...reads, "notifications:write"]);
    expect(
      (
        await request(
          "/api/admin/account-choices?purpose=notifications",
          staff.cookie,
        )
      ).status,
    ).toBe(200);
    expect(
      (await request("/api/notification-jobs", staff.cookie, job)).status,
    ).toBe(200);
    expect(
      (await request("/api/notification-jobs/deliver", staff.cookie, {}))
        .status,
    ).toBe(403);
    expect(
      (
        await request(
          "/api/notification-jobs/email-review/process",
          staff.cookie,
          {},
        )
      ).status,
    ).toBe(403);
    await grant([...reads, "notifications:deliver"]);
    expect(
      (await request("/api/notification-jobs/deliver", staff.cookie, {}))
        .status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/notification-jobs/${jobId}/cancel`,
          staff.cookie,
          {},
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await (await request("/api/notifications", customer.cookie)).json()
      ).items.map((row: { title: string }) => row.title),
    ).toContain(job.title);
    expect(
      (await (await request("/api/notifications", staff.cookie)).json()).items,
    ).toEqual([]);
    await sql`INSERT INTO mail_jobs (id, recipient_id, recipient_email, subject, body, html, url, state) VALUES (${jobId}, ${customer.id}, ${emails[2]}, 'Fixture', 'Fixture', 'Fixture', ${base}, 'failed')`;
    expect(
      (
        await request(
          `/api/notification-jobs/${jobId}/email-review`,
          staff.cookie,
          { attempts: 0 },
        )
      ).status,
    ).toBe(403);
    await grant([...reads, "notifications:review"]);
    expect(
      (
        await request(
          `/api/notification-jobs/${jobId}/email-review`,
          staff.cookie,
          { attempts: 0 },
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await request(
          "/api/notification-jobs/email-review/process",
          staff.cookie,
          {},
        )
      ).status,
    ).toBe(403);

    const all = permissionSchema.options.filter(
      (permission) => permission !== "team:manage",
    );
    await grant(all);
    expect(
      (
        await sql`SELECT after_permissions FROM admin_audit_events WHERE target_id = ${staff.id} AND action = 'member.permissions_changed' ORDER BY id DESC LIMIT 1`
      )[0].after_permissions,
    ).toEqual(all);
    for (const path of ["/api/team", "/api/audit", "/api/business"])
      expect((await request(path, staff.cookie)).status).toBe(403);
    expect(
      (
        await sql`SELECT actor_id FROM admin_audit_events WHERE target_id = ${invoiceId} AND action = 'invoice.created'`
      )[0].actor_id,
    ).toBe(staff.id);
    await grant([]);
    // Even malformed dormant action grants cannot bypass the read dependency or membership boundary.
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${staff.id}, 'billing:create'), (${customer.id}, 'billing:read'), (${customer.id}, 'billing:create')`;
    expect((await request("/api/billing", staff.cookie, invoice)).status).toBe(
      403,
    );
    expect(
      (await request("/api/billing", customer.cookie, invoice)).status,
    ).toBe(403);
    for (const path of [
      "/api/scheduling/bookings?scope=all",
      "/api/notification-jobs",
      "/api/billing?scope=all",
      "/api/admin/account-choices?purpose=billing",
    ])
      expect((await request(path, staff.cookie)).status).toBe(403);
    expect((await request("/api/auth/get-session", staff.cookie)).status).toBe(
      200,
    );
  } finally {
    await sql`DELETE FROM bookings WHERE id = ${bookingId}`;
    await sql`DELETE FROM scheduling_resources WHERE id = ${resourceId}`;
    await sql`DELETE FROM billing_invoices WHERE id IN (${invoiceId}, ${checkoutId}, ${voidId})`;
    await sql`DELETE FROM notification_jobs WHERE id = ${jobId}`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY(${emails}))`;
    await sql`DELETE FROM "user" WHERE email = ANY(${emails})`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ANY(${emails})`;
    await sql.end();
  }
}, 30000);
