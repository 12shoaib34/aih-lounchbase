import { businessInvoiceDefaults } from "../shared/invoiceDefaults";
import { recordAudit, recordBusinessAudit } from "./audit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import Stripe from "stripe";
import { z } from "zod";
import { authenticate, allowed, ApiFault, type AppEnv } from "./access";
import { connectDatabase } from "./database";
import {
  invoiceListQuery,
  invoiceInput,
  invoiceTotals,
  invoiceDraftUpdate,
  invoiceDocument,
} from "../shared/billing";

// Stripe represents whole ISK and UGX charges in hundredths.
export function providerAmount(amount: number, currency: string) {
  return /^(ISK|UGX)$/i.test(currency) ? amount * 100 : amount;
}

const stripe = (env: AppEnv["Bindings"]) => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET)
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "Online payments are not configured.",
    );
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    timeout: 10000,
    maxNetworkRetries: 0,
  });
};
export const billingWebhook = new Hono<AppEnv>();
billingWebhook.post("/", bodyLimit({ maxSize: 131072 }), async (c) => {
  const provider = stripe(c.env);
  let event: Stripe.Event;
  try {
    event = await provider.webhooks.constructEventAsync(
      await c.req.text(),
      c.req.header("stripe-signature") ?? "",
      c.env.STRIPE_WEBHOOK_SECRET!,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    );
  } catch {
    throw new ApiFault(
      400,
      "INVALID_SIGNATURE",
      "Webhook could not be verified.",
    );
  }
  if (
    ![
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
    ].includes(event.type)
  )
    return c.json({ received: true });
  const session = event.data.object as Stripe.Checkout.Session;
  const id = z.uuid().safeParse(session.metadata?.invoiceId);
  if (!id.success || session.payment_status !== "paid")
    return c.json({ received: true });
  const sql = connectDatabase(c.env);
  try {
    await sql.begin(async (tx) => {
      const inserted =
        await tx`INSERT INTO billing_provider_events (id, invoice_id, outcome) VALUES (${event.id}, ${id.data}, 'review') ON CONFLICT DO NOTHING RETURNING id`;
      if (!inserted.length) return;
      const [invoice] =
        await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
      if (
        !invoice ||
        session.mode !== "payment" ||
        invoice.checkout_session_id !== session.id ||
        providerAmount(invoice.amount, invoice.currency) !==
          session.amount_total ||
        invoice.currency.toLowerCase() !== session.currency
      )
        return;
      if (
        invoice.status === "paid" &&
        invoice.payment_source === "stripe" &&
        invoice.payment_reference === session.id
      ) {
        await tx`UPDATE billing_provider_events SET outcome = 'ignored' WHERE id = ${event.id}`;
        return;
      }
      if (invoice.status !== "issued" || invoice.amount === 0) return;
      await tx`UPDATE billing_invoices SET status = 'paid', version = version + 1, payment_source = 'stripe', payment_reference = ${session.id}, checkout_url = NULL WHERE id = ${id.data}`;
      await tx`UPDATE billing_provider_events SET outcome = 'applied' WHERE id = ${event.id}`;
      await recordAudit(tx, {
        action: "invoice.payment_confirmed",
        actorType: "service",
        actorId: "stripe",
        targetType: "invoice",
        targetId: id.data,
        requestId: c.get("requestId"),
      });
    });
  } finally {
    await sql.end();
  }
  return c.json({ received: true });
});
export const billing = new Hono<AppEnv>();
billing.use("*", authenticate);
billing.get("/review", async (c) => {
  if (!allowed(c, "billing:review"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Payment review permission is required.",
    );
  const sql = c.get("database");
  const events =
    await sql`SELECT id, invoice_id::text AS "invoiceId", outcome, created_at::text AS "createdAt", acknowledged_at::text AS "acknowledgedAt", acknowledged_by AS "acknowledgedBy" FROM billing_provider_events ORDER BY (outcome = 'review' AND acknowledged_at IS NULL) DESC, created_at DESC, id LIMIT 100`;
  const attempts =
    await sql`SELECT id, version, number::text, checkout_attempt_at::text AS "attemptedAt", checkout_session_id AS "sessionId", (checkout_attempt_token IS NOT NULL) AS "canLinkSession" FROM billing_invoices WHERE status = 'issued' AND checkout_attempt_at IS NOT NULL ORDER BY checkout_attempt_at, id LIMIT 100`;
  const recoveries =
    await sql`SELECT invoice_id::text AS "invoiceId", session_id AS "sessionId", generation, recovered_at::text AS "recoveredAt" FROM billing_checkout_recoveries ORDER BY recovered_at DESC, session_id LIMIT 100`;
  return c.json({
    events,
    attempts,
    recoveries,
    canAcknowledge: c.get("teamRole") === "owner",
    canReconcile:
      c.get("teamRole") === "owner" &&
      !!c.env.STRIPE_SECRET_KEY &&
      !!c.env.STRIPE_WEBHOOK_SECRET,
  });
});
billing.post("/review/acknowledge", bodyLimit({ maxSize: 4096 }), async (c) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Only the owner can acknowledge payment review.",
    );
  const input = z
    .strictObject({ eventId: z.string().min(1).max(128) })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid event reference.");
  await c.get("database").begin(async (tx) => {
    const [event] =
      await tx`SELECT outcome, acknowledged_at FROM billing_provider_events WHERE id = ${input.data.eventId} FOR UPDATE`;
    if (!event || event.outcome !== "review")
      throw new ApiFault(
        409,
        "CONFLICT",
        "Only a recorded review event can be acknowledged. Refresh the review.",
      );
    if (event.acknowledged_at) return;
    await tx`UPDATE billing_provider_events SET acknowledged_at = now(), acknowledged_by = ${c.get("userId")} WHERE id = ${input.data.eventId}`;
    await recordBusinessAudit(
      tx,
      c,
      "payment_review.acknowledged",
      "payment-event",
      input.data.eventId,
    );
  });
  return c.json({ acknowledged: true });
});
// Owner-triggered recovery of a known paid session; never create or reset checkout.
billing.post("/:id/reconcile", async (c) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Only the owner can reconcile payments.",
    );
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
  const sql = c.get("database");
  const [before] =
    await sql`SELECT * FROM billing_invoices WHERE id = ${id.data}`;
  if (
    !before ||
    !before.checkout_session_id ||
    !["issued", "paid"].includes(before.status)
  )
    throw new ApiFault(
      409,
      "PAYMENT_REVIEW",
      "A recorded checkout session is required. Investigate the payment with the operator.",
    );
  const provider = stripe(c.env);
  let session: Stripe.Checkout.Session;
  try {
    session = await provider.checkout.sessions.retrieve(
      before.checkout_session_id,
    );
  } catch {
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "Provider verification failed. No payment status was changed; try again later.",
    );
  }
  if (
    session.id !== before.checkout_session_id ||
    session.metadata?.invoiceId !== before.id ||
    session.mode !== "payment" ||
    session.amount_total !== providerAmount(before.amount, before.currency) ||
    session.currency !== before.currency.toLowerCase()
  )
    throw new ApiFault(
      409,
      "PAYMENT_REVIEW",
      "Provider details do not match this invoice. Operator investigation is required.",
    );
  if (session.status !== "complete" || session.payment_status !== "paid")
    throw new ApiFault(
      409,
      "PAYMENT_REVIEW",
      "The provider has not confirmed a completed paid checkout. Payment status and checkout restrictions are unchanged.",
    );
  await sql.begin(async (tx) => {
    const [invoice] =
      await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
    if (
      !invoice ||
      invoice.checkout_session_id !== before.checkout_session_id ||
      invoice.amount !== before.amount ||
      invoice.currency !== before.currency
    )
      throw new ApiFault(
        409,
        "CONFLICT",
        "Invoice changed during verification. Refresh and investigate before retrying.",
      );
    if (
      invoice.status === "paid" &&
      invoice.payment_source === "stripe" &&
      invoice.payment_reference === session.id
    )
      return;
    if (invoice.status !== "issued" || invoice.version !== before.version)
      throw new ApiFault(
        409,
        "CONFLICT",
        "Invoice changed during verification. Refresh and investigate before retrying.",
      );
    await tx`UPDATE billing_invoices SET status = 'paid', version = version + 1, payment_source = 'stripe', payment_reference = ${session.id}, checkout_url = NULL WHERE id = ${id.data}`;
    await recordBusinessAudit(
      tx,
      c,
      "invoice.payment_confirmed",
      "invoice",
      id.data,
    );
  });
  return c.json({ status: "paid" });
});
billing.post(
  "/:id/recover-checkout",
  bodyLimit({ maxSize: 4096 }),
  async (c) => {
    if (c.get("teamRole") !== "owner")
      throw new ApiFault(
        403,
        "FORBIDDEN",
        "Only the owner can recover checkout.",
      );
    const id = z.uuid().safeParse(c.req.param("id"));
    const input = z
      .strictObject({
        sessionId: z.string().min(1).max(255),
        version: z.number().int().positive(),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!id.success || !input.success)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Refresh and select a recorded checkout.",
      );
    const sql = c.get("database");
    const [before] =
      await sql`SELECT * FROM billing_invoices WHERE id = ${id.data}`;
    if (
      !before ||
      before.status !== "issued" ||
      before.version !== input.data.version ||
      before.checkout_session_id !== input.data.sessionId
    )
      throw new ApiFault(
        409,
        "CONFLICT",
        "Checkout changed. Refresh before trying again.",
      );
    const provider = stripe(c.env);
    let session: Stripe.Checkout.Session;
    try {
      session = await provider.checkout.sessions.retrieve(
        before.checkout_session_id,
      );
    } catch {
      throw new ApiFault(
        503,
        "UNAVAILABLE",
        "Provider verification failed. Checkout was not reset.",
      );
    }
    if (
      session.id !== before.checkout_session_id ||
      session.metadata?.invoiceId !== before.id ||
      session.mode !== "payment" ||
      session.amount_total !== providerAmount(before.amount, before.currency) ||
      session.currency !== before.currency.toLowerCase() ||
      session.status !== "expired" ||
      session.payment_status !== "unpaid" ||
      session.payment_intent !== null ||
      (session.after_expiration !== null &&
        session.after_expiration?.recovery?.enabled !== false)
    )
      throw new ApiFault(
        409,
        "PAYMENT_REVIEW",
        "Recovery requires a matching expired unpaid session without a payment intent or recovery link. Investigate with the payment operator.",
      );
    await sql.begin(async (tx) => {
      const [invoice] =
        await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
      if (
        !invoice ||
        invoice.status !== "issued" ||
        invoice.version !== before.version ||
        invoice.checkout_session_id !== before.checkout_session_id ||
        invoice.checkout_generation !== before.checkout_generation ||
        invoice.amount !== before.amount ||
        invoice.currency !== before.currency
      )
        throw new ApiFault(
          409,
          "CONFLICT",
          "Checkout changed during verification. Refresh before retrying.",
        );
      const [review] =
        await tx`SELECT id FROM billing_provider_events WHERE invoice_id = ${id.data} AND outcome = 'review' LIMIT 1`;
      if (review)
        throw new ApiFault(
          409,
          "PAYMENT_REVIEW",
          "Provider review events still require investigation. Acknowledgement does not release checkout.",
        );
      await tx`INSERT INTO billing_checkout_recoveries (session_id, invoice_id, generation, recovered_by) VALUES (${session.id}, ${id.data}, ${invoice.checkout_generation}, ${c.get("userId")})`;
      await tx`UPDATE billing_invoices SET checkout_session_id = NULL, checkout_url = NULL, checkout_expires_at = NULL, checkout_attempt_at = NULL, checkout_attempt_token = NULL, version = version + 1 WHERE id = ${id.data}`;
      await recordBusinessAudit(
        tx,
        c,
        "invoice.checkout_recovered",
        "invoice",
        id.data,
      );
    });
    return c.json({ recovered: true });
  },
);
billing.post("/:id/link-session", bodyLimit({ maxSize: 4096 }), async (c) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Only the owner can link a missing checkout session.",
    );
  const id = z.uuid().safeParse(c.req.param("id"));
  const input = z
    .strictObject({
      sessionId: z.string().regex(/^cs_[A-Za-z0-9_]{1,240}$/),
      version: z.number().int().positive(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!id.success || !input.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Enter a valid provider session reference and refresh the invoice.",
    );
  const sql = c.get("database");
  const [before] =
    await sql`SELECT * FROM billing_invoices WHERE id = ${id.data}`;
  if (
    !before ||
    before.status !== "issued" ||
    before.version !== input.data.version ||
    before.checkout_session_id ||
    !before.checkout_attempt_at ||
    !before.checkout_attempt_token
  )
    throw new ApiFault(
      409,
      "PAYMENT_REVIEW",
      "A current missing-session attempt with a recorded attempt identity is required. Legacy attempts need operator investigation.",
    );
  const provider = stripe(c.env);
  let session: Stripe.Checkout.Session;
  try {
    session = await provider.checkout.sessions.retrieve(input.data.sessionId);
  } catch {
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "Provider verification failed. No checkout session was linked.",
    );
  }
  if (
    session.id !== input.data.sessionId ||
    session.metadata?.invoiceId !== before.id ||
    session.metadata?.attemptToken !== before.checkout_attempt_token ||
    session.metadata?.generation !== String(before.checkout_generation + 1) ||
    session.mode !== "payment" ||
    session.amount_total !== providerAmount(before.amount, before.currency) ||
    session.currency !== before.currency.toLowerCase() ||
    !["open", "complete", "expired"].includes(session.status ?? "") ||
    !Number.isSafeInteger(session.expires_at) ||
    session.expires_at <= 0 ||
    session.expires_at > 8640000000000
  )
    throw new ApiFault(
      409,
      "PAYMENT_REVIEW",
      "Provider session does not match this checkout attempt. Investigate with the payment operator.",
    );
  // Linking identifies the attempt only. Never expose a new payment URL or
  // infer settlement from this step; use explicit reconciliation afterwards.
  await sql.begin(async (tx) => {
    const [invoice] =
      await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
    if (
      !invoice ||
      invoice.status !== "issued" ||
      invoice.version !== before.version ||
      invoice.checkout_session_id ||
      invoice.checkout_attempt_token !== before.checkout_attempt_token ||
      invoice.checkout_generation !== before.checkout_generation ||
      invoice.amount !== before.amount ||
      invoice.currency !== before.currency
    )
      throw new ApiFault(
        409,
        "CONFLICT",
        "Checkout changed during verification. Refresh before retrying.",
      );
    const [existing] =
      await tx`SELECT session_id FROM billing_checkout_recoveries WHERE session_id = ${session.id}`;
    if (existing)
      throw new ApiFault(
        409,
        "PAYMENT_REVIEW",
        "This session was already recovered and cannot be linked again.",
      );
    await tx`UPDATE billing_invoices SET checkout_session_id = ${session.id}, checkout_generation = checkout_generation + 1, checkout_expires_at = ${new Date(session.expires_at * 1000)}, checkout_url = NULL, version = version + 1 WHERE id = ${id.data}`;
    await recordBusinessAudit(
      tx,
      c,
      "invoice.checkout_linked",
      "invoice",
      id.data,
    );
  });
  return c.json({ linked: true });
});
billing.get("/", async (c) => {
  const scope = z
    .enum(["all", "mine"])
    .optional()
    .safeParse(c.req.query("scope"));
  if (!scope.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid invoice scope.");
  const owner =
    scope.data === "all" ||
    (scope.data !== "mine" && c.get("teamRole") === "owner");
  if (owner && !allowed(c, "billing:read"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Invoice review permission is required.",
    );
  const items = await c.get(
    "database",
  )`SELECT id, number::text, customer_name AS "customerName", currency, amount, status, version, payment_source AS "paymentSource", payment_reference AS "paymentReference", items FROM billing_invoices WHERE ${owner} OR (customer_id = ${c.get("userId")} AND status <> 'draft') ORDER BY created_at DESC, id LIMIT 100`;
  return c.json({
    checkout: !!c.env.STRIPE_SECRET_KEY && !!c.env.STRIPE_WEBHOOK_SECRET,
    items,
  });
});
billing.get("/list", async (c) => {
  if (!allowed(c, "billing:read"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Invoice review permission is required.",
    );
  const parsed = invoiceListQuery.safeParse(c.req.query());
  if (!parsed.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Check invoice filters.");
  const { search, status, page } = parsed.data;
  // Reuse the pool already opened for this request's session and live grants.
  const db = c.get("databasePool");
  const pageSize = 20;
  // strpos treats user search literally, including SQL wildcard characters.
  const needle = search.toLowerCase();
  const where = `($1::text = 'all' OR status = $1) AND ($2::text = '' OR strpos(lower(concat_ws(' ', number::text, customer_name, document->>'reference', document->>'billToName', document->>'billToEmail')), $2) > 0)`;
  const {
    rows: [count],
  } = await db.query(
    `SELECT count(*)::int AS total FROM billing_invoices WHERE ${where}`,
    [status, needle],
  );
  const { rows } = await db.query(
    `SELECT id, number::text, customer_name, currency, status, items, document FROM billing_invoices WHERE ${where} ORDER BY created_at DESC, id LIMIT $3 OFFSET $4`,
    [status, needle, pageSize, (page - 1) * pageSize],
  );
  return c.json({
    total: count.total,
    page,
    pageSize,
    items: rows.map((row) => {
      const document = invoiceDocument.parse(row.document);
      const totals = invoiceTotals({
        currency: row.currency,
        items: row.items,
        document,
      });
      return {
        id: row.id,
        reference: document.reference || row.number,
        recipient: document.billToName || row.customer_name,
        invoiceDate: document.invoiceDate,
        dueDate: document.dueDate,
        currency: row.currency,
        status: row.status,
        total: totals.total,
        balance:
          row.status === "paid" || row.status === "void" ? 0 : totals.balance,
      };
    }),
  });
});
billing.get("/defaults", async (c) => {
  if (!allowed(c, "billing:create"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Invoice creation permission is required.",
    );
  const {
    rows: [row],
  } = await c
    .get("databasePool")
    .query("SELECT data FROM business_settings WHERE singleton");
  return c.json(businessInvoiceDefaults(row?.data ?? null));
});
// Fixed review routes are registered before the individual invoice read.
billing.get("/:id", async (c) => {
  if (!allowed(c, "billing:read"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Invoice review permission is required.",
    );
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
  const {
    rows: [invoice],
  } = await c
    .get("databasePool")
    .query(
      `SELECT id, number::text, document, customer_id AS "customerId", customer_name AS "customerName", currency, amount, status, version, payment_source AS "paymentSource", payment_reference AS "paymentReference", items FROM billing_invoices WHERE id = $1`,
      [id.data],
    );
  if (!invoice) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
  return c.json({
    ...invoice,
    checkout: !!c.env.STRIPE_SECRET_KEY && !!c.env.STRIPE_WEBHOOK_SECRET,
  });
});
billing.put("/:id", bodyLimit({ maxSize: 524288 }), async (c) => {
  if (!allowed(c, "billing:edit"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Draft editing permission is required.",
    );
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
  const parsed = invoiceDraftUpdate.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check customer, currency and line items.",
    );
  const { data, version } = parsed.data;
  await c.get("database").begin(async (tx) => {
    const [invoice] =
      await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
    if (!invoice) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
    if (
      invoice.version !== version ||
      invoice.status !== "draft" ||
      invoice.checkout_session_id ||
      invoice.checkout_attempt_at ||
      invoice.checkout_attempt_token
    )
      throw new ApiFault(
        409,
        "CONFLICT",
        "Invoice changed or is no longer an editable draft. Your changes were not saved. Load the latest invoice before editing again.",
      );
    const [customer] = data.customerId
      ? await tx`SELECT name FROM "user" WHERE id = ${data.customerId} FOR KEY SHARE`
      : [];
    if (data.customerId && !customer)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Customer account not found.",
      );
    const totals = invoiceTotals(data);
    const previousPaid = invoiceTotals({
      currency: invoice.currency,
      items: invoice.items,
      document: invoiceDocument.parse(invoice.document),
    }).amountPaid;
    if (
      (totals.amountPaid !== previousPaid ||
        (previousPaid > 0 && invoice.currency !== data.currency)) &&
      !allowed(c, "billing:record-payment")
    )
      throw new ApiFault(
        403,
        "FORBIDDEN",
        "Payment recording permission is required to change amount paid.",
      );
    const amount = totals.balance;
    await tx`UPDATE billing_invoices SET customer_id = ${data.customerId}, customer_name = ${customer?.name ?? data.document.billToName}, currency = ${data.currency}, document = ${tx.json(data.document)}, items = ${tx.json(data.items)}, amount = ${amount}, version = version + 1 WHERE id = ${id.data}`;
    await recordBusinessAudit(tx, c, "invoice.updated", "invoice", id.data);
  });
  return c.json({ id: id.data });
});
billing.post("/", bodyLimit({ maxSize: 524288 }), async (c) => {
  if (!allowed(c, "billing:create"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Draft creation permission is required.",
    );
  const parsed = z
    .object({ id: z.uuid(), data: invoiceInput })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check customer, currency and line items. Prices must use integer minor units.",
    );
  const { id, data } = parsed.data;
  const totals = invoiceTotals(data);
  if (totals.amountPaid > 0 && !allowed(c, "billing:record-payment"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Payment recording permission is required to enter amount paid.",
    );
  const amount = totals.balance;
  const sql = c.get("database");
  const row = await sql.begin(async (tx) => {
    const [user] = data.customerId
      ? await tx`SELECT name FROM "user" WHERE id = ${data.customerId} FOR KEY SHARE`
      : [];
    if (data.customerId && !user)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Customer account not found.",
      );
    const created =
      await tx`INSERT INTO billing_invoices (id, customer_id, customer_name, currency, amount, items, document) VALUES (${id}, ${data.customerId}, ${user?.name ?? data.document.billToName}, ${data.currency}, ${amount}, ${tx.json(data.items)}, ${tx.json(data.document)}) ON CONFLICT DO NOTHING RETURNING id`;
    if (created.length)
      await recordBusinessAudit(tx, c, "invoice.created", "invoice", id);
    const [same] =
      await tx`SELECT id FROM billing_invoices WHERE id = ${id} AND customer_id IS NOT DISTINCT FROM ${data.customerId} AND currency = ${data.currency} AND items = ${tx.json(data.items)}::jsonb AND (${tx.json(invoiceDocument.parse({}))}::jsonb || document) = ${tx.json(data.document)}::jsonb`;
    if (!same)
      throw new ApiFault(
        409,
        "CONFLICT",
        "This invoice request was already used.",
      );
    return same;
  });
  return c.json(row);
});
billing.post("/:id/action", bodyLimit({ maxSize: 4096 }), async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  const input = z
    .object({
      action: z.enum(["issue", "void", "record-payment"]),
      version: z.number().int().positive(),
      reference: z.string().trim().max(120).optional(),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!id.success || !input.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid invoice action.");
  const required =
    input.data.action === "issue"
      ? "billing:issue"
      : input.data.action === "void"
        ? "billing:void"
        : "billing:record-payment";
  if (!allowed(c, required))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "You do not have access to this invoice action.",
    );
  const result = await c.get("database").begin(async (tx) => {
    const [invoice] =
      await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} FOR UPDATE`;
    if (!invoice || invoice.version !== input.data.version)
      throw new ApiFault(
        409,
        "CONFLICT",
        "Invoice changed. Refresh before trying again.",
      );
    const { action, reference } = input.data;
    if (invoice.checkout_session_id || invoice.checkout_attempt_at)
      throw new ApiFault(
        409,
        "CHECKOUT_EXISTS",
        "This invoice has an online checkout. Resolve it with the payment operator before making manual changes.",
      );
    const allowed =
      action === "issue"
        ? invoice.status === "draft"
        : action === "void"
          ? ["draft", "issued"].includes(invoice.status)
          : invoice.status === "issued" && !!reference;
    if (!allowed)
      throw new ApiFault(
        409,
        "INVALID_STATE",
        "That action is not allowed in the current state; external payment records also require a reference.",
      );
    const status =
      action === "issue"
        ? invoice.amount === 0
          ? "paid"
          : "issued"
        : action === "void"
          ? "void"
          : "paid";
    await tx`UPDATE billing_invoices SET status = ${status}, version = version + 1, payment_source = ${action === "record-payment" ? "manual" : null}, payment_reference = ${action === "record-payment" ? reference! : null} WHERE id = ${id.data}`;
    await recordBusinessAudit(
      tx,
      c,
      action === "issue"
        ? "invoice.issued"
        : action === "void"
          ? "invoice.voided"
          : "invoice.payment_recorded",
      "invoice",
      id.data,
    );
    return { status };
  });
  return c.json(result);
});
billing.post("/:id/checkout", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
  const provider = stripe(c.env);
  // Commit before the external call: a lost response must not erase the retry window.
  await c.get("database").begin(async (tx) => {
    const [invoice] =
      await tx`SELECT checkout_attempt_at FROM billing_invoices WHERE id = ${id.data} AND status = 'issued' AND (customer_id = ${c.get("userId")} OR ${allowed(c, "billing:checkout")}) FOR UPDATE`;
    if (!invoice)
      throw new ApiFault(
        409,
        "INVALID_STATE",
        "An issued unpaid invoice is required to start checkout.",
      );
    if (invoice.checkout_attempt_at) return;
    await tx`UPDATE billing_invoices SET checkout_attempt_at = now(), checkout_attempt_token = ${crypto.randomUUID()} WHERE id = ${id.data}`;
    await recordBusinessAudit(
      tx,
      c,
      "invoice.checkout_started",
      "invoice",
      id.data,
    );
  });
  const result = await c.get("database").begin(async (tx) => {
    const [invoice] =
      await tx`SELECT * FROM billing_invoices WHERE id = ${id.data} AND (customer_id = ${c.get("userId")} OR ${allowed(c, "billing:checkout")}) FOR UPDATE`;
    if (!invoice) throw new ApiFault(404, "NOT_FOUND", "Invoice not found.");
    if (invoice.status !== "issued" || invoice.amount === 0)
      throw new ApiFault(
        409,
        "INVALID_STATE",
        "Only issued unpaid invoices can start checkout.",
      );
    const [review] =
      await tx`SELECT id FROM billing_provider_events WHERE invoice_id = ${id.data} AND outcome = 'review' LIMIT 1`;
    if (review)
      throw new ApiFault(
        409,
        "PAYMENT_REVIEW",
        "Payment confirmation needs review. Contact the business before trying another payment.",
      );
    if (
      invoice.checkout_url &&
      new Date(invoice.checkout_expires_at).getTime() > Date.now()
    )
      return { url: invoice.checkout_url };
    if (invoice.checkout_session_id)
      throw new ApiFault(
        409,
        "PAYMENT_REVIEW",
        "The previous checkout needs review before another payment can be started. Contact the business.",
      );
    if (
      Date.now() - new Date(invoice.checkout_attempt_at).getTime() >
      23 * 60 * 60 * 1000
    )
      throw new ApiFault(
        409,
        "PAYMENT_REVIEW",
        "An earlier payment attempt needs review. Contact the business before trying again.",
      );
    const generation = invoice.checkout_generation + 1;
    let session: Stripe.Checkout.Session;
    try {
      session = await provider.checkout.sessions.create(
        {
          mode: "payment",
          metadata: {
            invoiceId: invoice.id,
            ...(invoice.checkout_attempt_token
              ? {
                  attemptToken: invoice.checkout_attempt_token,
                  generation: String(generation),
                }
              : {}),
          },
          success_url: new URL(
            "/app/account/billing?checkout=returned",
            c.env.AUTH_BASE_URL,
          ).href,
          cancel_url: new URL("/app/account/billing", c.env.AUTH_BASE_URL).href,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: invoice.currency.toLowerCase(),
                unit_amount: providerAmount(invoice.amount, invoice.currency),
                product_data: { name: `Invoice ${invoice.number}` },
              },
            },
          ],
        },
        { idempotencyKey: `invoice-${invoice.id}-${generation}` },
      );
    } catch (error) {
      // Only a definitive input rejection can release this attempt for retry.
      if (
        !(error instanceof Stripe.errors.StripeInvalidRequestError) ||
        error.statusCode !== 400 ||
        !error.requestId ||
        ![
          "parameter_invalid_integer",
          "amount_too_small",
          "amount_too_large",
          "parameter_invalid_empty",
        ].includes(error.code ?? "")
      )
        throw error;
      await tx`UPDATE billing_invoices SET checkout_attempt_at = NULL, checkout_attempt_token = NULL, checkout_generation = ${generation} WHERE id = ${id.data}`;
      await recordBusinessAudit(
        tx,
        c,
        "invoice.checkout_rejected",
        "invoice",
        id.data,
      );
      return { rejected: true as const };
    }
    if (!session.url || new URL(session.url).hostname !== "checkout.stripe.com")
      throw new ApiFault(503, "UNAVAILABLE", "Checkout could not be created.");
    await tx`UPDATE billing_invoices SET checkout_session_id = ${session.id}, checkout_url = ${session.url}, checkout_expires_at = ${new Date(session.expires_at * 1000)}, checkout_generation = ${generation} WHERE id = ${id.data}`;
    await recordBusinessAudit(
      tx,
      c,
      "invoice.checkout_created",
      "invoice",
      id.data,
    );
    return { url: session.url };
  });
  if ("rejected" in result)
    throw new ApiFault(
      409,
      "CHECKOUT_REJECTED",
      "The payment provider declined this invoice setup. Contact the business.",
    );
  return c.json(result);
});
