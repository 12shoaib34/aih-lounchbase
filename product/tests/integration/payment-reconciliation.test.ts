import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import postgres from "postgres";
import { it, expect, vi } from "vitest";
import app from "../../server/index";

it.each([
  ["USD", 1000],
  ["JPY", 1000],
  ["ISK", 100000],
  ["UGX", 100000],
] as const)(
  "checks %s checkout, reconciliation, recovery and signed webhook amounts",
  checkPayments,
  30000,
);

async function checkPayments(currency: string, providerAmount: number) {
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
  const invoiceId = randomUUID();
  const rejectionId = randomUUID();
  const sessionId = `cs_test_${randomUUID().replaceAll("-", "")}`;
  try {
    const owner = await register(emails[0]);
    const staff = await register(emails[1]);
    const customer = await register(emails[2]);
    await sql`INSERT INTO team_members (user_id, role) VALUES (${owner.id}, 'owner'), (${staff.id}, 'staff')`;
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${staff.id}, 'billing:read'), (${staff.id}, 'billing:review')`;
    await sql`INSERT INTO billing_invoices (id, customer_id, customer_name, currency, amount, items, status) VALUES (${invoiceId}, ${customer.id}, 'Fixture', ${currency}, 1400, '[{"description":"Service","quantity":1,"unitAmount":1400}]', 'issued')`;
    const receive = (amount: number, version: number, cookie = owner.cookie) =>
      request(`/api/billing/${invoiceId}/action`, cookie, {
        action: "record-payment",
        reference: "deposit",
        amount,
        version,
        method: "Cash",
        date: "2026-01-01",
      });
    expect((await receive(400, 1, customer.cookie)).status).toBe(403);
    expect((await receive(1401, 1)).status).toBe(400);
    expect(
      (await Promise.all([receive(400, 1), receive(400, 1)]))
        .map((r) => r.status)
        .sort(),
    ).toEqual([200, 409]);
    const details = await (
      await request(`/api/billing/${invoiceId}`, owner.cookie)
    ).json();
    expect(details).toMatchObject({
      amount: 1000,
      partial: true,
      payments: [{ amount: 400, method: "Cash", actor: "Audit tester" }],
    });
    const portal = await (
      await request("/api/billing?scope=mine", customer.cookie)
    ).json();
    expect(portal.items[0]).toMatchObject({
      partial: true,
      amount: 1000,
      total: 1400,
      receipts: [{ date: "2026-01-01", amount: 400, method: "Cash" }],
    });
    expect(portal.items[0].receipts[0]).not.toHaveProperty("actor");
    const outstanding = await (
      await request("/api/billing/list?status=outstanding", owner.cookie)
    ).json();
    expect(
      outstanding.items.find((row: { id: string }) => row.id === invoiceId),
    ).toMatchObject({ partial: true, balance: 1000, total: 1400 });
    expect(
      (
        await request(`/api/billing/${invoiceId}/action`, owner.cookie, {
          action: "void",
          version: 2,
        })
      ).status,
    ).toBe(409);
    await sql`UPDATE billing_invoices SET checkout_session_id=${sessionId},checkout_attempt_at=now() WHERE id=${invoiceId}`;
    expect((await receive(100, 2)).status).toBe(409);
    const bindings = {
      ...env,
      STRIPE_SECRET_KEY: ["sk", "test", randomUUID()].join("_"),
      STRIPE_WEBHOOK_SECRET: randomUUID(),
    };
    const call = (cookie = owner.cookie) =>
      request(
        `/api/billing/${invoiceId}/reconcile`,
        cookie,
        undefined,
        "POST",
        bindings,
      );
    const evidence = {
      id: sessionId,
      metadata: { invoiceId },
      mode: "payment",
      amount_total: providerAmount,
      currency: currency.toLowerCase(),
      status: "complete",
      payment_status: "paid",
    };
    if (currency === "ISK" || currency === "UGX") {
      await sql`UPDATE billing_invoices SET checkout_url = 'https://checkout.stripe.com/legacy', checkout_expires_at = now() + interval '1 hour' WHERE id = ${invoiceId}`;
      expect(
        (
          await request(
            `/api/billing/${invoiceId}/checkout`,
            customer.cookie,
            undefined,
            "POST",
            bindings,
          )
        ).status,
      ).toBe(409);
    }
    let response: object = evidence;
    let fail = false;
    let race = false;
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = input instanceof Request ? input.url : String(input);
        expect(url).toBe(
          `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
        );
        expect(
          input instanceof Request ? input.method : (init?.method ?? "GET"),
        ).toBe("GET");
        if (fail) throw new Error("private-provider-error");
        if (race)
          await sql`UPDATE billing_invoices SET version = version + 1 WHERE id = ${invoiceId}`;
        return new Response(JSON.stringify(response), {
          headers: { "Content-Type": "application/json" },
        });
      });
    expect((await call(customer.cookie)).status).toBe(403);
    expect((await call(staff.cookie)).status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
    for (const mismatch of [
      { id: "wrong" },
      { metadata: {} },
      { mode: "subscription" },
      { amount_total: providerAmount === 1000 ? 999 : 1000 },
      { currency: "eur" },
      { status: "expired", payment_status: "unpaid" },
      { payment_status: "unpaid" },
    ]) {
      response = { ...evidence, ...mismatch };
      expect((await call()).status).toBe(409);
      expect(
        (
          await sql`SELECT status FROM billing_invoices WHERE id = ${invoiceId}`
        )[0].status,
      ).toBe("issued");
    }
    response = evidence;
    fail = true;
    const unavailable = await call();
    expect(unavailable.status).toBe(503);
    expect(await unavailable.text()).not.toContain("private-provider-error");
    fail = false;
    race = true;
    expect((await call()).status).toBe(409);
    race = false;
    await sql`CREATE FUNCTION test_reject_reconciliation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'invoice.payment_confirmed' THEN RAISE EXCEPTION 'Simulated audit failure'; END IF; RETURN NEW; END; $$`;
    try {
      await sql`CREATE TRIGGER test_reconciliation_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_reconciliation_audit()`;
      expect((await call()).status).toBe(500);
      expect(
        (
          await sql`SELECT status FROM billing_invoices WHERE id = ${invoiceId}`
        )[0].status,
      ).toBe("issued");
    } finally {
      await sql`DROP TRIGGER IF EXISTS test_reconciliation_audit_failure ON admin_audit_events`;
      await sql`DROP FUNCTION test_reject_reconciliation_audit()`;
    }
    expect((await call()).status).toBe(200);
    const [paid] =
      await sql`SELECT status, version, payment_source, payment_reference FROM billing_invoices WHERE id = ${invoiceId}`;
    expect(paid).toMatchObject({
      status: "paid",
      payment_source: "stripe",
      payment_reference: sessionId,
    });
    expect((await call()).status).toBe(200);
    expect(
      (
        await sql`SELECT version FROM billing_invoices WHERE id = ${invoiceId}`
      )[0].version,
    ).toBe(paid.version);
    const audits =
      await sql`SELECT actor_id FROM admin_audit_events WHERE action = 'invoice.payment_confirmed' AND target_id = ${invoiceId}`;
    expect(audits).toEqual([{ actor_id: owner.id }]);
    const signing = new Stripe(bindings.STRIPE_SECRET_KEY);
    async function webhook(amount: number) {
      const eventId = `evt_${randomUUID()}`;
      const payload = JSON.stringify({
        id: eventId,
        type: "checkout.session.completed",
        data: { object: { ...evidence, amount_total: amount } },
      });
      const signature = signing.webhooks.generateTestHeaderString({
        payload,
        secret: bindings.STRIPE_WEBHOOK_SECRET,
      });
      const res = await app.request(
        base + "/api/billing-webhook",
        {
          method: "POST",
          headers: { "stripe-signature": signature },
          body: payload,
        },
        bindings,
      );
      expect(res.status).toBe(200);
      const [event] =
        await sql`SELECT outcome FROM billing_provider_events WHERE id = ${eventId}`;
      return event.outcome;
    }
    await sql`UPDATE billing_invoices SET status='issued', payment_source=NULL, payment_reference=NULL WHERE id=${invoiceId}`;
    expect(await webhook(providerAmount === 1000 ? 999 : 1000)).toBe("review");
    expect(await webhook(providerAmount)).toBe("applied");
    await sql`DELETE FROM billing_provider_events WHERE invoice_id=${invoiceId}`;
    // A separate issued fixture state exercises conservative expired recovery.
    await sql`UPDATE billing_invoices SET status = 'issued', payment_source = NULL, payment_reference = NULL, checkout_generation = 1 WHERE id = ${invoiceId}`;
    let version = (
      await sql`SELECT version FROM billing_invoices WHERE id = ${invoiceId}`
    )[0].version;
    const recover = (cookie = owner.cookie, expectedVersion = version) =>
      request(
        `/api/billing/${invoiceId}/recover-checkout`,
        cookie,
        { sessionId, version: expectedVersion },
        "POST",
        bindings,
      );
    const expired = {
      ...evidence,
      status: "expired",
      payment_status: "unpaid",
      payment_intent: null,
      after_expiration: null,
    };
    const callsBeforeDenial = fetcher.mock.calls.length;
    expect((await recover(staff.cookie)).status).toBe(403);
    expect((await recover(customer.cookie)).status).toBe(403);
    expect((await recover(owner.cookie, version + 1)).status).toBe(409);
    expect(fetcher.mock.calls.length).toBe(callsBeforeDenial);
    for (const mismatch of [
      { id: "wrong" },
      { amount_total: 1 },
      { currency: "eur" },
      { metadata: {} },
      { mode: "setup" },
      { status: "open" },
      { status: "complete" },
      { payment_status: "paid" },
      { payment_intent: "pi_pending" },
      { payment_intent: undefined },
      { after_expiration: { recovery: { enabled: true } } },
      { after_expiration: undefined },
    ]) {
      response = { ...expired, ...mismatch };
      expect((await recover()).status).toBe(409);
    }
    response = expired;
    fail = true;
    expect((await recover()).status).toBe(503);
    fail = false;
    race = true;
    expect((await recover()).status).toBe(409);
    race = false;
    version = (
      await sql`SELECT version FROM billing_invoices WHERE id = ${invoiceId}`
    )[0].version;
    const reviewId = `review-${invoiceId}`;
    await sql`INSERT INTO billing_provider_events (id, invoice_id, outcome, acknowledged_at) VALUES (${reviewId}, ${invoiceId}, 'review', now())`;
    expect((await recover()).status).toBe(409);
    await sql`DELETE FROM billing_provider_events WHERE id = ${reviewId}`;
    await sql`CREATE FUNCTION test_reject_recovery_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'invoice.checkout_recovered' THEN RAISE EXCEPTION 'Simulated audit failure'; END IF; RETURN NEW; END; $$`;
    try {
      await sql`CREATE TRIGGER test_recovery_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_recovery_audit()`;
      expect((await recover()).status).toBe(500);
      expect(
        (
          await sql`SELECT checkout_session_id FROM billing_invoices WHERE id = ${invoiceId}`
        )[0].checkout_session_id,
      ).toBe(sessionId);
      expect(
        await sql`SELECT session_id FROM billing_checkout_recoveries WHERE invoice_id = ${invoiceId}`,
      ).toHaveLength(0);
    } finally {
      await sql`DROP TRIGGER IF EXISTS test_recovery_audit_failure ON admin_audit_events`;
      await sql`DROP FUNCTION test_reject_recovery_audit()`;
    }
    expect((await recover()).status).toBe(200);
    expect(
      (
        await sql`SELECT status, checkout_generation, checkout_session_id, checkout_attempt_at FROM billing_invoices WHERE id = ${invoiceId}`
      )[0],
    ).toMatchObject({
      status: "issued",
      checkout_generation: 1,
      checkout_session_id: null,
      checkout_attempt_at: null,
    });
    expect(
      await sql`SELECT session_id, recovered_by FROM billing_checkout_recoveries WHERE invoice_id = ${invoiceId}`,
    ).toEqual([{ session_id: sessionId, recovered_by: owner.id }]);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE action = 'invoice.checkout_recovered' AND target_id = ${invoiceId}`,
    ).toHaveLength(1);
    expect((await recover()).status).toBe(409); // stale replay cannot reset a later attempt
    const calls = fetcher.mock.calls.length;
    expect((await call()).status).toBe(409);
    expect(fetcher.mock.calls.length).toBe(calls);
    let submittedToken = "";
    fetcher.mockImplementation(async (input, init) => {
      const headers =
        input instanceof Request ? input.headers : new Headers(init?.headers);
      expect(headers.get("Idempotency-Key")).toBe(`invoice-${invoiceId}-2`);
      expect(input instanceof Request ? input.method : init?.method).toBe(
        "POST",
      );
      const form = new URLSearchParams(
        input instanceof Request ? await input.text() : String(init?.body),
      );
      expect(form.get("line_items[0][price_data][unit_amount]")).toBe(
        String(providerAmount),
      );
      submittedToken = form.get("metadata[attemptToken]") ?? "";
      expect(submittedToken).toMatch(/^[a-f0-9-]{36}$/);
      expect(form.get("metadata[generation]")).toBe("2");
      throw new Error("Simulated creation response loss");
    });
    expect(
      (
        await request(
          `/api/billing/${invoiceId}/checkout`,
          customer.cookie,
          undefined,
          "POST",
          bindings,
        )
      ).status,
    ).toBe(500);
    const [attempt] =
      await sql`SELECT checkout_attempt_token, checkout_attempt_at, version FROM billing_invoices WHERE id = ${invoiceId}`;
    expect(attempt.checkout_attempt_token).toBe(submittedToken);
    let linkVersion = attempt.version;
    const link = (cookie = owner.cookie) =>
      request(
        `/api/billing/${invoiceId}/link-session`,
        cookie,
        { sessionId: "cs_replacement", version: linkVersion },
        "POST",
        bindings,
      );
    const linkedEvidence = {
      ...evidence,
      id: "cs_replacement",
      metadata: { invoiceId, attemptToken: submittedToken, generation: "2" },
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    };
    response = linkedEvidence;
    fetcher.mockImplementation(async (input, init) => {
      expect(
        input instanceof Request ? input.method : (init?.method ?? "GET"),
      ).toBe("GET");
      expect(input instanceof Request ? input.url : String(input)).toBe(
        "https://api.stripe.com/v1/checkout/sessions/cs_replacement",
      );
      if (fail) throw new Error("Private provider failure");
      if (race)
        await sql`UPDATE billing_invoices SET version = version + 1 WHERE id = ${invoiceId}`;
      return new Response(JSON.stringify(response), {
        headers: { "Content-Type": "application/json" },
      });
    });
    let beforeCalls = fetcher.mock.calls.length;
    expect((await link(customer.cookie)).status).toBe(403);
    expect((await link(staff.cookie)).status).toBe(403);
    expect(fetcher.mock.calls.length).toBe(beforeCalls);
    await sql`UPDATE billing_invoices SET checkout_attempt_token = NULL WHERE id = ${invoiceId}`;
    expect((await link()).status).toBe(409);
    expect(fetcher.mock.calls.length).toBe(beforeCalls);
    await sql`UPDATE billing_invoices SET checkout_attempt_token = ${submittedToken} WHERE id = ${invoiceId}`;
    for (const mismatch of [
      { metadata: { invoiceId } },
      { metadata: { ...linkedEvidence.metadata, generation: "1" } },
      {
        metadata: { ...linkedEvidence.metadata, attemptToken: randomUUID() },
      },
      { amount_total: 1 },
      { currency: "eur" },
      { mode: "setup" },
      { id: "cs_wrong" },
      { expires_at: null },
    ]) {
      response = { ...linkedEvidence, ...mismatch };
      expect((await link()).status).toBe(409);
    }
    response = linkedEvidence;
    fail = true;
    expect((await link()).status).toBe(503);
    fail = false;
    race = true;
    expect((await link()).status).toBe(409);
    race = false;
    linkVersion = (
      await sql`SELECT version FROM billing_invoices WHERE id = ${invoiceId}`
    )[0].version;
    await sql`CREATE FUNCTION test_reject_link_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'invoice.checkout_linked' THEN RAISE EXCEPTION 'Simulated audit failure'; END IF; RETURN NEW; END; $$`;
    try {
      await sql`CREATE TRIGGER test_link_audit_failure BEFORE INSERT ON admin_audit_events FOR EACH ROW EXECUTE FUNCTION test_reject_link_audit()`;
      expect((await link()).status).toBe(500);
      expect(
        (
          await sql`SELECT checkout_session_id FROM billing_invoices WHERE id = ${invoiceId}`
        )[0].checkout_session_id,
      ).toBeNull();
    } finally {
      await sql`DROP TRIGGER IF EXISTS test_link_audit_failure ON admin_audit_events`;
      await sql`DROP FUNCTION test_reject_link_audit()`;
    }
    expect((await link()).status).toBe(200);
    expect((await link()).status).toBe(409);
    expect(
      (
        await sql`SELECT status, checkout_url, checkout_attempt_at FROM billing_invoices WHERE id = ${invoiceId}`
      )[0],
    ).toMatchObject({
      status: "issued",
      checkout_url: null,
      checkout_attempt_at: attempt.checkout_attempt_at,
    });
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE action = 'invoice.checkout_linked' AND target_id = ${invoiceId}`,
    ).toHaveLength(1);
    expect((await recover()).status).toBe(409);
    expect(
      (
        await sql`SELECT checkout_generation, checkout_session_id FROM billing_invoices WHERE id = ${invoiceId}`
      )[0],
    ).toMatchObject({
      checkout_generation: 2,
      checkout_session_id: "cs_replacement",
    });
    await sql`INSERT INTO billing_invoices (id, customer_id, customer_name, currency, amount, items, status) VALUES (${rejectionId}, ${customer.id}, 'Checkout fixture', ${currency}, 1000, '[]', 'issued')`;
    const checkout = () =>
      request(
        `/api/billing/${rejectionId}/checkout`,
        customer.cookie,
        undefined,
        "POST",
        bindings,
      );
    const rejection = (code: string, param?: string) =>
      new Response(
        JSON.stringify({
          error: {
            type: "invalid_request_error",
            code,
            param,
            message: "provider validation",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    for (const [index, code] of [
      "amount_too_small",
      "currency_not_supported",
      "parameter_invalid_enum",
    ].entries()) {
      fetcher.mockResolvedValueOnce(
        rejection(
          code,
          code === "parameter_invalid_enum"
            ? "line_items[0][price_data][currency]"
            : undefined,
        ),
      );
      expect(await (await checkout()).json()).toMatchObject({
        error: { code: "CHECKOUT_REJECTED" },
      });
      const [row] =
        await sql`SELECT amount, status, checkout_attempt_at, checkout_attempt_token, checkout_generation FROM billing_invoices WHERE id = ${rejectionId}`;
      expect(row).toMatchObject({
        amount: 1000,
        status: "issued",
        checkout_attempt_at: null,
        checkout_attempt_token: null,
        checkout_generation: index + 1,
      });
    }
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE target_id = ${rejectionId} AND action='invoice.checkout_rejected'`,
    ).toHaveLength(3);
    const voidInvoice = (version: number) =>
      request(`/api/billing/${rejectionId}/action`, owner.cookie, {
        action: "void",
        version,
      });
    const [released] =
      await sql`SELECT version FROM billing_invoices WHERE id = ${rejectionId}`;
    expect((await voidInvoice(released.version)).status).toBe(200);
    // Reset the isolated fixture for a separate ambiguous dispatch.
    await sql`UPDATE billing_invoices SET status='issued' WHERE id=${rejectionId}`;
    fetcher.mockRejectedValueOnce(new Error("Timed out waiting for response"));
    expect((await checkout()).status).toBe(500);
    fetcher.mockResolvedValueOnce(rejection("amount_too_small"));
    expect(await (await checkout()).json()).toMatchObject({
      error: { code: "PAYMENT_REVIEW" },
    });
    const [pending] =
      await sql`SELECT checkout_attempt_token, version FROM billing_invoices WHERE id = ${rejectionId}`;
    expect(pending.checkout_attempt_token).toBeTruthy();
    expect(await (await voidInvoice(pending.version)).json()).toMatchObject({
      error: { code: "CHECKOUT_EXISTS" },
    });
    const success = {
      id: "cs_concurrent",
      url: "https://checkout.stripe.com/concurrent",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    };
    fetcher.mockImplementation(
      async () =>
        new Response(JSON.stringify(success), {
          headers: { "Content-Type": "application/json" },
        }),
    );
    const previousCalls = fetcher.mock.calls.length;
    const results = await Promise.all([checkout(), checkout()]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(fetcher.mock.calls.length - previousCalls).toBe(1);
  } finally {
    vi.restoreAllMocks();
    await sql`DELETE FROM billing_invoices WHERE id = ${rejectionId}`;
    await sql`DELETE FROM billing_provider_events WHERE invoice_id = ${invoiceId}`;
    await sql`DELETE FROM billing_invoices WHERE id = ${invoiceId}`;
    for (const email of emails) {
      await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email = ${email})`;
      await sql`DELETE FROM "user" WHERE email = ${email}`;
      await sql`DELETE FROM auth_mail_outbox WHERE recipient = ${email}`;
    }
    await sql.end();
  }
}
