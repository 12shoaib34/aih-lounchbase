import { businessInput } from "../../shared/business";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import postgres from "postgres";
import Stripe from "stripe";
import { it, expect } from "vitest";
import { deliverMailJobs } from "../../server/mail-jobs";
import app from "../../server/index";

it("enforces live team permissions, isolates records, and rolls back conflicting bulk writes", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("A dedicated migrated test database is required.");
  const sql = postgres(process.env.DATABASE_URL);
  const suffix = randomUUID();
  const contactId = randomUUID();
  const importedId = randomUUID();
  const invoiceIds = [randomUUID(), randomUUID()];
  const emails = [
    `owner-${suffix}@example.com`,
    `customer-${suffix}@example.com`,
  ];
  const base = "http://localhost:8787";
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_BASE_URL: base + "/",
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
    TEAM_INVITES_ENABLED: "true",
  };
  let ip = 1;
  const request = (
    path: string,
    cookie = "",
    body?: object,
    method = body ? "POST" : "GET",
  ) =>
    app.request(
      path.startsWith("http") ? path : base + path,
      {
        method,
        headers: {
          Origin: base,
          Cookie: cookie,
          "Content-Type": "application/json",
          "cf-connecting-ip": `2001:db8:${suffix.slice(0, 4)}:${suffix.slice(4, 8)}::${ip++}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      env,
    );
  async function register(email: string) {
    const password = "A strong test password 123!";
    expect(
      (
        await request("/api/auth/sign-up/email", "", {
          email,
          password,
          name: "Access test",
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
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const [user] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
    return { cookie, id: user.id as string };
  }
  try {
    const owner = await register(emails[0]);
    const customer = await register(emails[1]);
    expect((await request("/api/admin")).status).toBe(401);
    expect((await request("/api/admin", customer.cookie)).status).toBe(403);
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      403,
    );
    // An orphan permission row must never turn a customer into a team member.
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${customer.id}, 'users:read')`;
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      403,
    );
    await promisify(execFile)(
      process.execPath,
      ["scripts/bootstrap-owner.mjs", emails[0]],
      { env: process.env },
    );
    await promisify(execFile)(
      process.execPath,
      ["scripts/bootstrap-owner.mjs", emails[0]],
      { env: process.env },
    );
    await expect(
      promisify(execFile)(
        process.execPath,
        ["scripts/bootstrap-owner.mjs", emails[1]],
        { env: process.env },
      ),
    ).rejects.toThrow();
    expect((await request("/api/admin", owner.cookie)).status).toBe(200);
    const invoiceData = {
      customerId: customer.id,
      currency: "USD",
      items: [{ description: "Service", quantity: 2, unitAmount: 500 }],
    };
    expect(
      (
        await request("/api/billing", customer.cookie, {
          id: invoiceIds[0],
          data: invoiceData,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/api/billing", owner.cookie, {
          id: invoiceIds[0],
          data: invoiceData,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await (await request("/api/billing", customer.cookie)).json()
      ).items.some((item: { id: string }) => item.id === invoiceIds[0]),
    ).toBe(false);
    expect(
      (
        await request(`/api/billing/${invoiceIds[0]}/action`, owner.cookie, {
          action: "issue",
          version: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/billing/${invoiceIds[0]}/action`, owner.cookie, {
          action: "void",
          version: 1,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await (await request("/api/billing", customer.cookie)).json()
      ).items.find((item: { id: string }) => item.id === invoiceIds[0]).amount,
    ).toBe(1000);
    expect(
      (
        await request(
          `/api/billing/${invoiceIds[0]}/checkout`,
          customer.cookie,
          {},
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await request(`/api/billing/${invoiceIds[0]}/action`, customer.cookie, {
          action: "record-payment",
          version: 2,
          reference: "receipt",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(`/api/billing/${invoiceIds[0]}/action`, owner.cookie, {
          action: "record-payment",
          version: 2,
          reference: "external-receipt",
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(`/api/billing/${invoiceIds[0]}/action`, owner.cookie, {
          action: "void",
          version: 3,
        })
      ).status,
    ).toBe(409);
    await request("/api/billing", owner.cookie, {
      id: invoiceIds[1],
      data: invoiceData,
    });
    await request(`/api/billing/${invoiceIds[1]}/action`, owner.cookie, {
      action: "issue",
      version: 1,
    });
    const stripeKey = ["sk", "test", randomUUID()].join("_");
    const webhookSecret = randomUUID();
    const provider = new Stripe(stripeKey);
    const paymentEnv = {
      ...env,
      STRIPE_SECRET_KEY: stripeKey,
      STRIPE_WEBHOOK_SECRET: webhookSecret,
    };
    const originalFetch = globalThis.fetch;
    let checkoutCalls = 0;
    let loseCheckoutResponse = true;
    globalThis.fetch = async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.startsWith("https://api.stripe.com/"))
        return originalFetch(input, init);
      checkoutCalls++;
      if (loseCheckoutResponse)
        throw new Error("Simulated lost provider response");
      const body =
        input instanceof Request ? await input.text() : String(init?.body);
      expect(
        new URLSearchParams(body).get("line_items[0][price_data][unit_amount]"),
      ).toBe("1000");
      return new Response(
        JSON.stringify({
          id: `cs_${invoiceIds[1]}`,
          url: "https://checkout.stripe.com/test-session",
          expires_at: Math.floor(Date.now() / 1000) + 1800,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    };
    try {
      const checkout = () =>
        app.request(
          `${base}/api/billing/${invoiceIds[1]}/checkout`,
          {
            method: "POST",
            headers: { Cookie: customer.cookie, Origin: base },
          },
          paymentEnv,
        );
      expect((await checkout()).status).toBe(500);
      expect(
        (
          await sql`SELECT checkout_attempt_at FROM billing_invoices WHERE id = ${invoiceIds[1]}`
        )[0].checkout_attempt_at,
      ).not.toBeNull();
      await sql`UPDATE billing_invoices SET checkout_attempt_at = now() - interval '24 hours' WHERE id = ${invoiceIds[1]}`;
      expect((await checkout()).status).toBe(409);
      expect(checkoutCalls).toBe(1);
      await sql`UPDATE billing_invoices SET checkout_attempt_at = now() WHERE id = ${invoiceIds[1]}`;
      loseCheckoutResponse = false;
      expect((await checkout()).status).toBe(200);
      expect((await checkout()).status).toBe(200);
      expect(checkoutCalls).toBe(2);
      await sql`UPDATE billing_invoices SET checkout_expires_at = now() - interval '1 minute' WHERE id = ${invoiceIds[1]}`;
      expect((await checkout()).status).toBe(409);
      expect(checkoutCalls).toBe(2);
      await sql`UPDATE billing_invoices SET checkout_expires_at = now() + interval '1 hour' WHERE id = ${invoiceIds[1]}`;
      const reviewEvent = `review-${suffix}`;
      await sql`INSERT INTO billing_provider_events (id, invoice_id, outcome) VALUES (${reviewEvent}, ${invoiceIds[1]}, 'review')`;
      expect((await checkout()).status).toBe(409);
      expect(checkoutCalls).toBe(2);
      expect(
        (await request("/api/billing/review", customer.cookie)).status,
      ).toBe(403);
      const review = await (
        await request("/api/billing/review", owner.cookie)
      ).json();
      expect(
        review.events.some((event: { id: string }) => event.id === reviewEvent),
      ).toBe(true);
      expect(
        review.attempts.some(
          (attempt: { id: string }) => attempt.id === invoiceIds[1],
        ),
      ).toBe(true);
      // Audit failure must roll back acknowledgement, not leave an unaudited mark.
      await sql`CREATE FUNCTION test_reject_payment_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'payment_review.acknowledged' THEN RAISE EXCEPTION 'Simulated audit failure'; END IF; RETURN NEW; END; $$`;
      try {
        await sql`CREATE TRIGGER test_payment_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_payment_audit()`;
        expect(
          (
            await request("/api/billing/review/acknowledge", owner.cookie, {
              eventId: reviewEvent,
            })
          ).status,
        ).toBe(500);
        expect(
          (
            await sql`SELECT acknowledged_at FROM billing_provider_events WHERE id = ${reviewEvent}`
          )[0].acknowledged_at,
        ).toBeNull();
      } finally {
        await sql`DROP TRIGGER IF EXISTS test_payment_audit_failure ON admin_audit_events`;
        await sql`DROP FUNCTION test_reject_payment_audit()`;
      }
      const acknowledgement = { eventId: reviewEvent };
      expect(
        (
          await request(
            "/api/billing/review/acknowledge",
            customer.cookie,
            acknowledgement,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            "/api/billing/review/acknowledge",
            owner.cookie,
            acknowledgement,
          )
        ).status,
      ).toBe(200);
      const [firstAcknowledgement] =
        await sql`SELECT acknowledged_at, acknowledged_by FROM billing_provider_events WHERE id = ${reviewEvent}`;
      expect(firstAcknowledgement.acknowledged_at).not.toBeNull();
      expect(
        (
          await request(
            "/api/billing/review/acknowledge",
            owner.cookie,
            acknowledgement,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await sql`SELECT acknowledged_at, acknowledged_by FROM billing_provider_events WHERE id = ${reviewEvent}`
        )[0],
      ).toEqual(firstAcknowledgement);
      expect(
        (
          await sql`SELECT id FROM admin_audit_events WHERE action = 'payment_review.acknowledged' AND target_id = ${reviewEvent}`
        ).length,
      ).toBe(1);
      expect((await checkout()).status).toBe(409);
      expect(checkoutCalls).toBe(2);
      expect(
        (
          await request("/api/billing/review/acknowledge", owner.cookie, {
            eventId: "missing-event",
          })
        ).status,
      ).toBe(409);
      await sql`DELETE FROM billing_provider_events WHERE id = ${reviewEvent}`;
    } finally {
      globalThis.fetch = originalFetch;
    }
    const eventId = `evt_${randomUUID()}`;
    const payload = JSON.stringify({
      id: eventId,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_${invoiceIds[1]}`,
          mode: "payment",
          payment_status: "paid",
          amount_total: 1000,
          currency: "usd",
          metadata: { invoiceId: invoiceIds[1] },
        },
      },
    });
    const signature = provider.webhooks.generateTestHeaderString({
      payload,
      secret: webhookSecret,
    });
    const webhook = (header: string) =>
      app.request(
        `${base}/api/billing-webhook`,
        {
          method: "POST",
          headers: {
            "stripe-signature": header,
            "Content-Type": "application/json",
          },
          body: payload,
        },
        paymentEnv,
      );
    expect((await webhook("invalid")).status).toBe(400);
    expect((await webhook(signature)).status).toBe(200);
    expect((await webhook(signature)).status).toBe(200);
    expect(
      (
        await sql`SELECT status, payment_source FROM billing_invoices WHERE id = ${invoiceIds[1]}`
      )[0],
    ).toMatchObject({ status: "paid", payment_source: "stripe" });
    expect(
      await sql`SELECT id FROM billing_provider_events WHERE id = ${eventId}`,
    ).toHaveLength(1);
    expect(
      await (
        await request("/api/notifications/preferences", customer.cookie)
      ).json(),
    ).toEqual({ email: false });
    expect(
      (
        await request(
          "/api/notifications/preferences",
          customer.cookie,
          { email: true },
          "PUT",
        )
      ).status,
    ).toBe(200);
    const jobId = randomUUID();
    const job = {
      id: jobId,
      recipientId: customer.id,
      title: "Private notice",
      email: true,
      body: "Only this customer",
      dueAt: new Date(Date.now() - 1000).toISOString(),
    };
    expect(
      (await request("/api/notification-jobs", customer.cookie, job)).status,
    ).toBe(403);
    expect(
      (await request("/api/notification-jobs", owner.cookie, job)).status,
    ).toBe(200);
    expect(
      (await request("/api/notification-jobs", owner.cookie, job)).status,
    ).toBe(200);
    await Promise.all([
      request("/api/notification-jobs/deliver", owner.cookie, {}),
      request("/api/notification-jobs/deliver", owner.cookie, {}),
    ]);
    expect(
      await sql`SELECT id FROM auth_mail_outbox WHERE delivery_key = ${jobId}`,
    ).toHaveLength(1);
    // A worker crash after outbox acceptance must not create a second email.
    await sql`UPDATE mail_jobs SET state = 'processing', lease_until = now() - interval '1 minute' WHERE id = ${jobId}`;
    expect(
      (await request("/api/notification-jobs/deliver", owner.cookie, {}))
        .status,
    ).toBe(200);
    expect(
      await sql`SELECT id FROM auth_mail_outbox WHERE delivery_key = ${jobId}`,
    ).toHaveLength(1);
    const optedOutId = randomUUID();
    expect(
      (
        await request("/api/notification-jobs", owner.cookie, {
          ...job,
          id: optedOutId,
        })
      ).status,
    ).toBe(200);
    await request(
      "/api/notifications/preferences",
      customer.cookie,
      { email: false },
      "PUT",
    );
    await request("/api/notification-jobs/deliver", owner.cookie, {});
    expect(
      await sql`SELECT id FROM auth_mail_outbox WHERE delivery_key = ${optedOutId}`,
    ).toHaveLength(0);
    expect(
      (await sql`SELECT state FROM mail_jobs WHERE id = ${optedOutId}`)[0]
        .state,
    ).toBe("cancelled");
    const inbox = await (
      await request("/api/notifications", customer.cookie)
    ).json();
    expect(
      inbox.items.filter((item: { id: string }) => item.id === jobId),
    ).toHaveLength(1);
    expect(
      (await request(`/api/notifications/${jobId}/read`, owner.cookie, {}))
        .status,
    ).toBe(404);
    expect(
      (await request(`/api/notifications/${jobId}/read`, customer.cookie, {}))
        .status,
    ).toBe(204);
    expect(
      (
        await request(
          `/api/notification-jobs/${jobId}/cancel`,
          owner.cookie,
          {},
        )
      ).status,
    ).toBe(409);
    const futureId = randomUUID();
    expect(
      (
        await request("/api/notification-jobs", owner.cookie, {
          ...job,
          id: futureId,
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/notification-jobs/${futureId}/cancel`,
          owner.cookie,
          {},
        )
      ).status,
    ).toBe(204);
    // Provider failure retries retain one idempotency key, with a bounded window.
    await request(
      "/api/notifications/preferences",
      customer.cookie,
      { email: true },
      "PUT",
    );
    const retryId = randomUUID();
    await request("/api/notification-jobs", owner.cookie, {
      ...job,
      id: retryId,
    });
    await sql`UPDATE notification_jobs SET state = 'delivered' WHERE id = ${retryId}`;
    const originalMailFetch = globalThis.fetch;
    const mailKeys: string[] = [];
    let providerAccepts = false;
    globalThis.fetch = async (_input, init) => {
      mailKeys.push(new Headers(init?.headers).get("Idempotency-Key")!);
      return new Response("{}", { status: providerAccepts ? 200 : 503 });
    };
    const mailEnv = {
      ...env,
      AUTH_EMAIL_MODE: "resend",
      RESEND_API_KEY: "test-only",
      EMAIL_FROM: "test@example.com",
    };
    try {
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(
        (
          await sql`SELECT state, attempts FROM mail_jobs WHERE id = ${retryId}`
        )[0],
      ).toMatchObject({ state: "pending", attempts: 1 });
      expect(await deliverMailJobs(mailEnv)).toBe(0); // Backoff is respected.
      await sql`UPDATE mail_jobs SET next_attempt_at = now() WHERE id = ${retryId}`;
      providerAccepts = true;
      expect(await deliverMailJobs(mailEnv)).toBe(1);
      expect(mailKeys).toEqual([
        `notification-${retryId}`,
        `notification-${retryId}`,
      ]);
      await sql`UPDATE mail_jobs SET state = 'processing', first_attempt_at = now() - interval '24 hours', lease_until = now() - interval '1 minute' WHERE id = ${retryId}`;
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(
        (await sql`SELECT state FROM mail_jobs WHERE id = ${retryId}`)[0].state,
      ).toBe("failed");
      expect(mailKeys).toHaveLength(2);
      const history = await request(
        `/api/notification-jobs/${retryId}/email-attempts`,
        owner.cookie,
      );
      expect(
        (await history.json()).items.map(
          (item: { outcome: string }) => item.outcome,
        ),
      ).toEqual(["provider_error", "accepted"]);
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-attempts`,
            customer.cookie,
          )
        ).status,
      ).toBe(403);
      expect(
        (await request("/api/notification-jobs/email-review", customer.cookie))
          .status,
      ).toBe(403);
      expect(
        (
          await request(
            "/api/notification-jobs/email-review?page=0",
            owner.cookie,
          )
        ).status,
      ).toBe(400);
      const review = await (
        await request("/api/notification-jobs/email-review", owner.cookie)
      ).json();
      const failed = review.items.find(
        (item: { id: string }) => item.id === retryId,
      );
      expect(failed).toMatchObject({
        state: "failed",
        lastResult: "retry_window_expired",
        attempts: 2,
        reviewedAt: null,
      });
      expect(failed).not.toHaveProperty("body");
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-review`,
            customer.cookie,
            { attempts: 2 },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-review`,
            owner.cookie,
            { attempts: 1 },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-review`,
            owner.cookie,
            { attempts: 2 },
          )
        ).status,
      ).toBe(204);
      const [reviewed] =
        await sql`SELECT reviewed_at, reviewed_by FROM mail_jobs WHERE id = ${retryId}`;
      expect(reviewed.reviewed_by).toBeTruthy();
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-review`,
            owner.cookie,
            { attempts: 2 },
          )
        ).status,
      ).toBe(204);
      expect(
        (await sql`SELECT reviewed_at FROM mail_jobs WHERE id = ${retryId}`)[0]
          .reviewed_at,
      ).toEqual(reviewed.reviewed_at);
      expect(
        (
          await request(
            "/api/notification-jobs/email-review/process",
            customer.cookie,
            {},
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            "/api/notification-jobs/email-review/process",
            owner.cookie,
            {},
          )
        ).status,
      ).toBe(200);
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(mailKeys).toHaveLength(2);
      expect(
        (
          await sql`SELECT state, attempts FROM mail_jobs WHERE id = ${retryId}`
        )[0],
      ).toMatchObject({ state: "failed", attempts: 2 });

      // Simulate an interrupted transport: the outcome must stay unknown, never "not sent".
      await sql`UPDATE mail_jobs SET state = 'pending', first_attempt_at = now(), next_attempt_at = now(), reviewed_at = NULL, reviewed_by = NULL WHERE id = ${retryId}`;
      globalThis.fetch = async () => {
        throw new Error("test-only provider secret must not be persisted");
      };
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(
        (await sql`SELECT last_result FROM mail_jobs WHERE id = ${retryId}`)[0]
          .last_result,
      ).toBe("delivery_uncertain");
      // A worker crash after claiming leaves a processing attempt; the next claim records its expired lease.
      await sql`UPDATE mail_jobs SET state = 'processing', lease_until = now() - interval '1 minute' WHERE id = ${retryId}`;
      await sql`UPDATE mail_attempts SET outcome = 'processing', finished_at = NULL WHERE job_id = ${retryId} AND attempt = 3`;
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(
        (
          await sql`SELECT outcome FROM mail_attempts WHERE job_id = ${retryId} AND attempt = 3`
        )[0].outcome,
      ).toBe("lease_expired");
      await sql`UPDATE mail_jobs SET next_attempt_at = now() WHERE id = ${retryId}`;
      expect(await deliverMailJobs(mailEnv)).toBe(0);
      expect(
        (
          await sql`SELECT state, attempts, last_result FROM mail_jobs WHERE id = ${retryId}`
        )[0],
      ).toMatchObject({
        state: "failed",
        attempts: 5,
        last_result: "delivery_uncertain",
      });
      expect(
        (
          await request(
            `/api/notification-jobs/${retryId}/email-attempts`,
            owner.cookie,
          )
        ).status,
      ).toBe(200);
    } finally {
      globalThis.fetch = originalMailFetch;
    }
    const contactData = {
      name: `Contact ${suffix}`,
      email: "",
      phone: "",
      company: "Test",
      notes: "Private",
      tags: ["lead"],
      status: "active",
    };
    expect(
      (await request("/api/contacts/export", customer.cookie)).status,
    ).toBe(403);
    const importBody = {
      items: [
        { id: importedId, data: { ...contactData, name: "Imported contact" } },
      ],
    };
    expect(
      (await request("/api/contacts/import", customer.cookie, importBody))
        .status,
    ).toBe(403);
    expect(
      await (
        await request("/api/contacts/import", owner.cookie, importBody)
      ).json(),
    ).toEqual({ inserted: 1, unchanged: 0 });
    expect(
      await (
        await request("/api/contacts/import", owner.cookie, importBody)
      ).json(),
    ).toEqual({ inserted: 0, unchanged: 1 });
    expect((await request("/api/contacts", customer.cookie)).status).toBe(403);
    expect(
      (
        await request("/api/contacts", owner.cookie, {
          id: contactId.toUpperCase(),
          data: contactData,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request("/api/contacts", owner.cookie, {
          id: contactId.toUpperCase(),
          data: contactData,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/contacts", owner.cookie, {
          id: contactId.toUpperCase(),
          data: { ...contactData, name: "Other" },
        })
      ).status,
    ).toBe(409);
    // Force the audit insert itself to fail: the HTTP mutation must roll back too.
    await sql`CREATE FUNCTION test_reject_contact_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'contact.updated' THEN RAISE EXCEPTION 'Simulated audit failure'; END IF; RETURN NEW; END; $$`;
    try {
      await sql`CREATE TRIGGER test_contact_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_contact_audit()`;
      expect(
        (
          await request(
            `/api/contacts/${contactId}`,
            owner.cookie,
            { data: { ...contactData, name: "Must roll back" }, version: 1 },
            "PUT",
          )
        ).status,
      ).toBe(500);
      expect(
        (
          await sql`SELECT version, data FROM contacts WHERE id = ${contactId}`
        )[0],
      ).toMatchObject({ version: 1, data: contactData });
      expect(
        await sql`SELECT id FROM admin_audit_events WHERE target_id = ${contactId} AND action = 'contact.updated'`,
      ).toHaveLength(0);
    } finally {
      await sql`DROP TRIGGER IF EXISTS test_contact_audit_failure ON admin_audit_events`;
      await sql`DROP FUNCTION test_reject_contact_audit()`;
    }
    const contactList = await (
      await request(`/api/contacts?search=${suffix}`, owner.cookie)
    ).json();
    expect(contactList.total).toBe(1);
    expect(contactList.items[0].data.notes).toBe("Private");
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          customer.cookie,
          { data: contactData, version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          owner.cookie,
          { data: { ...contactData, status: "archived" }, version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/contacts/${contactId}`,
          owner.cookie,
          { data: contactData, version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await (
          await request(`/api/contacts?search=${suffix}`, owner.cookie)
        ).json()
      ).total,
    ).toBe(0);
    expect((await request("/api/business", customer.cookie)).status).toBe(403);
    const settingsBefore = await (
      await request("/api/business", owner.cookie)
    ).json();
    const businessData = {
      name: "Test business",
      legalName: "Example Studio Ltd",
      address: {
        line1: "38 Example Street",
        city: "London",
        country: "United Kingdom",
      },
      website: "https://example.com",
      invoiceDefaults: {
        currency: "EUR",
        dueDays: 30,
        paymentInstructions: "Use the invoice reference",
        notes: "Thank you",
        terms: "Net 30",
      },
      email: "",
      phone: "",
      timezone: "Asia/Karachi",
      currency: "PKR",
      locale: "en-PK",
      locations: [
        {
          id: randomUUID(),
          name: "Main",
          address: "",
          hours: [{ day: 1, opens: "09:00", closes: "17:00" }],
        },
      ],
    };
    const settingsSave = await request(
      "/api/business",
      owner.cookie,
      { data: businessData, version: settingsBefore.version },
      "PUT",
    );
    expect(settingsSave.status).toBe(200);
    expect(
      (await (await request("/api/business", owner.cookie)).json()).data,
    ).toEqual(businessInput.parse(businessData));
    expect(
      (
        await request(
          "/api/business",
          owner.cookie,
          { data: businessData, version: settingsBefore.version },
          "PUT",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          "/api/business",
          owner.cookie,
          {
            data: { ...businessData, timezone: "Invalid/Zone" },
            version: settingsBefore.version + 1,
          },
          "PUT",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          "/api/business",
          customer.cookie,
          { data: businessData, version: settingsBefore.version + 1 },
          "PUT",
        )
      ).status,
    ).toBe(403);
    if (settingsBefore.data)
      await sql`UPDATE business_settings SET data = ${sql.json(settingsBefore.data)}, version = ${settingsBefore.version} WHERE singleton`;
    else await sql`DELETE FROM business_settings`;
    const businessEvents =
      await sql`SELECT * FROM admin_audit_events WHERE actor_id = ${owner.id} AND action = 'business.updated'`;
    expect(businessEvents).toHaveLength(1);
    expect(businessEvents[0]).toMatchObject({
      target_type: "business",
      target_id: "settings",
      request_id: settingsSave.headers.get("X-Request-ID"),
    });
    const contactEvents =
      await sql`SELECT * FROM admin_audit_events WHERE target_id = ${contactId} ORDER BY id`;
    expect(contactEvents.map((event) => event.action)).toEqual([
      "contact.created",
      "contact.updated",
    ]);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE target_id = ${importedId} AND action = 'contact.imported'`,
    ).toHaveLength(1);
    expect(JSON.stringify(contactEvents)).not.toContain("Private");
    expect(JSON.stringify(contactEvents)).not.toContain(contactData.name);
    const invoiceEvents =
      await sql`SELECT action, actor_type, actor_id FROM admin_audit_events WHERE target_id = ${invoiceIds[0]} ORDER BY id`;
    expect(invoiceEvents.map((event) => event.action)).toEqual([
      "invoice.created",
      "invoice.issued",
      "invoice.payment_recorded",
    ]);
    const providerEvents =
      await sql`SELECT action, actor_type, actor_id FROM admin_audit_events WHERE target_id = ${invoiceIds[1]} ORDER BY id`;
    expect(providerEvents.map((event) => event.action)).toEqual([
      "invoice.created",
      "invoice.issued",
      "invoice.checkout_started",
      "invoice.checkout_created",
      "invoice.payment_confirmed",
    ]);
    expect(providerEvents.at(-1)).toMatchObject({
      actor_type: "service",
      actor_id: "stripe",
    });
    expect(providerEvents[2]).toMatchObject({
      actor_type: "account",
      actor_id: customer.id,
    });
    const filteredAudit = await (
      await request(
        `/api/audit?action=invoice.payment_confirmed&target=${invoiceIds[1]}`,
        owner.cookie,
      )
    ).json();
    expect(filteredAudit.items).toHaveLength(1);
    expect(filteredAudit.items[0]).toMatchObject({
      actorType: "service",
      actorId: "stripe",
      targetType: "invoice",
    });
    expect(
      (await request(`/api/audit?target=${invoiceIds[1]}`, customer.cookie))
        .status,
    ).toBe(403);
    const directory = await request(
      `/api/admin/users?search=${encodeURIComponent(emails[1])}`,
      owner.cookie,
    );
    expect(directory.status).toBe(200);
    expect((await directory.json()).items).toEqual([
      expect.objectContaining({ email: emails[1], teamRole: null }),
    ]);
    // Invitations grant only their explicit permissions and cannot promote owners.
    expect((await request("/api/team", customer.cookie)).status).toBe(403);
    expect(
      (
        await request("/api/team/invitations", owner.cookie, {
          email: emails[1],
          permissions: ["team:manage"],
        })
      ).status,
    ).toBe(400);
    const invite = () =>
      request("/api/team/invitations", owner.cookie, {
        email: emails[1],
        permissions: ["records:read:any"],
      });
    const readToken = async () => {
      const [mail] =
        await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${emails[1]} AND subject = 'Join your team' ORDER BY id DESC LIMIT 1`;
      return new URL(mail.url).hash.slice(1);
    };
    expect((await invite()).status).toBe(201);
    expect((await invite()).status).toBe(409);
    const token = await readToken();
    const [stored] =
      await sql`SELECT token_hash FROM team_invitations WHERE email = ${emails[1]}`;
    expect(stored.token_hash).not.toBe(token);
    expect(
      (await request("/api/team/accept", owner.cookie, { token })).status,
    ).toBe(409);
    expect(
      (await request("/api/team/accept", customer.cookie, { token })).status,
    ).toBe(200);
    expect(
      (await request("/api/team/accept", customer.cookie, { token })).status,
    ).toBe(409);
    expect((await request("/api/team", customer.cookie)).status).toBe(403);
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      403,
    );
    expect(
      (await request("/api/records?scope=all", customer.cookie)).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/team/members/${owner.id}`,
          owner.cookie,
          { version: 1 },
          "DELETE",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/team/members/${customer.id}`,
          owner.cookie,
          { version: 1, permissions: ["users:read"] },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/team/members/${customer.id}`,
          owner.cookie,
          { version: 1, permissions: [] },
          "PUT",
        )
      ).status,
    ).toBe(409);
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      200,
    );
    expect(
      (
        await request(
          `/api/team/members/${customer.id}`,
          owner.cookie,
          { version: 2 },
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect((await request("/api/admin", customer.cookie)).status).toBe(403);
    expect((await request("/api/profile", customer.cookie)).status).toBe(200);
    expect((await invite()).status).toBe(201);
    const cancelledToken = await readToken();
    const pending = (await (await request("/api/team", owner.cookie)).json())
      .invitations;
    expect(JSON.stringify(pending)).not.toContain(cancelledToken);
    expect(
      (
        await request(
          `/api/team/invitations/${pending[0].id}`,
          owner.cookie,
          undefined,
          "DELETE",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request("/api/team/accept", customer.cookie, {
          token: cancelledToken,
        })
      ).status,
    ).toBe(409);
    expect((await invite()).status).toBe(201);
    const expiredToken = await readToken();
    await sql`UPDATE team_invitations SET expires_at = now() - interval '1 second' WHERE email = ${emails[1]}`;
    expect(
      (
        await request("/api/team/accept", customer.cookie, {
          token: expiredToken,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await app.request(
          base + "/api/team/accept",
          {
            method: "POST",
            headers: {
              Origin: base,
              Cookie: customer.cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ token: expiredToken }),
          },
          { ...env, TEAM_INVITES_ENABLED: "false" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          base + "/api/team/invitations",
          {
            method: "POST",
            headers: {
              Origin: "https://evil.example",
              Cookie: owner.cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: emails[1], permissions: [] }),
          },
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await app.request(
          base + "/api/team/invitations",
          {
            method: "POST",
            headers: {
              Origin: base,
              Cookie: owner.cookie,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email: `unregistered-${suffix}@example.com`,
              permissions: [],
            }),
          },
          { ...env, AUTH_ALLOW_SIGNUP: "false" },
        )
      ).status,
    ).toBe(409);
    expect((await invite()).status).toBe(201);
    const concurrentToken = await readToken();
    const accepted = await Promise.all([
      request("/api/team/accept", customer.cookie, { token: concurrentToken }),
      request("/api/team/accept", customer.cookie, { token: concurrentToken }),
    ]);
    expect(accepted.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(
      (
        await request(
          `/api/team/members/${customer.id}`,
          owner.cookie,
          { version: 1 },
          "DELETE",
        )
      ).status,
    ).toBe(200);
    for (let i = 0; i < 10; i++)
      await sql`INSERT INTO team_invitations (id, email, token_hash, permissions, invited_by, expires_at, revoked_at) VALUES (${randomUUID()}, ${emails[1]}, ${randomUUID()}, '[]', ${owner.id}, now() + interval '1 day', now())`;
    expect((await invite()).status).toBe(409);
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${customer.id}, 'users:read')`;
    await sql`INSERT INTO team_members (user_id, role) VALUES (${customer.id}, 'staff')`;
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      200,
    );
    await sql`DELETE FROM user_permissions WHERE user_id = ${customer.id}`;
    expect((await request("/api/admin/users", customer.cookie)).status).toBe(
      403,
    );
    await sql`DELETE FROM team_members WHERE user_id = ${customer.id}`;
    expect((await request("/api/admin", customer.cookie)).status).toBe(403);
    const record = {
      id: randomUUID(),
      title: "Literal 100%",
      status: "active",
    };
    expect(
      (await request("/api/records", customer.cookie, record)).status,
    ).toBe(201);
    expect(
      (await request(`/api/records/${record.id}`, customer.cookie)).status,
    ).toBe(200);
    expect(
      (await request(`/api/records/${record.id}`, owner.cookie)).status,
    ).toBe(404);
    expect((await request(`/api/records/${record.id}`)).status).toBe(401);

    expect(
      (await request("/api/records", customer.cookie, record)).status,
    ).toBe(200);
    expect((await request("/api/records", owner.cookie, record)).status).toBe(
      409,
    );
    expect(
      (await request("/api/records?scope=all", customer.cookie)).status,
    ).toBe(403);
    expect(
      (await (await request("/api/records", owner.cookie)).json()).total,
    ).toBe(0);
    expect(
      (await (await request("/api/records?scope=all", owner.cookie)).json())
        .items,
    ).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: record.id })]),
    );
    expect(
      (await (await request("/api/records?search=%25", customer.cookie)).json())
        .total,
    ).toBe(1);
    expect(
      (
        await request(
          `/api/records/${record.id}`,
          owner.cookie,
          { title: "Intrusion", status: "active", version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          `/api/records/${record.id}`,
          customer.cookie,
          { title: "Updated", status: "active", version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/records/${record.id}`,
          customer.cookie,
          { title: "Stale", status: "active", version: 1 },
          "PUT",
        )
      ).status,
    ).toBe(409);
    // The valid ID sorts first, ensuring a later conflict rolls back an earlier write.
    const firstId = "00000000-0000-4000-8000-" + randomUUID().slice(-12);
    expect(
      (
        await request("/api/records", customer.cookie, {
          ...record,
          id: firstId,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await request("/api/records/archive", customer.cookie, {
          items: [
            { id: firstId, version: 1 },
            { id: "ffffffff-ffff-4fff-8fff-ffffffffffff", version: 1 },
          ],
        })
      ).status,
    ).toBe(409);
    const [unchanged] =
      await sql`SELECT status, version FROM reference_records WHERE id = ${firstId}`;
    expect(unchanged).toMatchObject({ status: "active", version: 1 });
    expect(
      (
        await request("/api/records/archive", customer.cookie, {
          items: [{ id: firstId, version: 1 }],
        })
      ).status,
    ).toBe(200);
  } finally {
    await sql`DELETE FROM billing_provider_events WHERE invoice_id IN (${invoiceIds[0]}, ${invoiceIds[1]})`;
    await sql`DELETE FROM billing_invoices WHERE id IN (${invoiceIds[0]}, ${invoiceIds[1]})`;
    await sql`DELETE FROM contacts WHERE id = ${contactId}`;
    await sql`DELETE FROM contacts WHERE id = ${importedId}`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email IN (${emails[0]}, ${emails[1]}))`;
    await sql`DELETE FROM "user" WHERE email IN (${emails[0]}, ${emails[1]})`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient IN (${emails[0]}, ${emails[1]})`;
    await sql.end();
  }
}, 60000);
