import {
  queueTrackingLink,
  deliverTrackingLinks,
} from "../../src/server/site/tracking-mail";
import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  allowed,
  ApiFault,
  authenticate,
  requirePermission,
  type AppEnv,
} from "./access";
import { connectDatabase } from "./database";
import { recordBusinessAudit } from "./audit";
import {
  inquiryInput,
  inquiryPageQuery,
  inquiryQuestions,
  storedInquiryAnswers,
} from "../shared/inquiries";
import { contactInput } from "../shared/contacts";

export const inquiries = new Hono<AppEnv>();
inquiries.post("/", bodyLimit({ maxSize: 32768 }), async (c) => {
  if (
    !c.env.AUTH_BASE_URL ||
    !c.env.AUTH_SECRET ||
    !(c.env.DATABASE_URL || c.env.HYPERDRIVE)
  )
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "Inquiries are currently unavailable.",
    );
  if (c.req.header("Origin") !== new URL(c.env.AUTH_BASE_URL).origin)
    throw new ApiFault(403, "FORBIDDEN", "Invalid request origin.");
  const parsed = inquiryInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check your contact details and required answers.",
    );
  const { id, name, email, phone, website } = parsed.data;
  if (website) return c.json({ received: true });
  const answers = inquiryQuestions.map((q) => ({
    key: q.key,
    label: q.label,
    value: parsed.data.answers[q.key] ?? "",
  }));
  const scope = createHmac("sha256", c.env.AUTH_SECRET)
    .update(c.req.header("CF-Connecting-IP") || "local")
    .digest("hex");
  const db = connectDatabase(c.env);
  try {
    const accepted = await db.begin(async (tx) => {
      // Serialize duplicate submissions and the two quota checks in the same transaction.
      await tx`SELECT pg_advisory_xact_lock(72184670)`;
      const [existing] =
        await tx`SELECT name=${name} AND email=${email} AND phone=${phone} AND answers=${tx.json(answers)}::jsonb AS same FROM customer_inquiries WHERE id=${id}`;
      if (existing) {
        if (!existing.same)
          throw new ApiFault(
            409,
            "CONFLICT",
            "This inquiry was already submitted with different details.",
          );
        return true;
      }
      await tx`DELETE FROM inquiry_rate_limits WHERE hour < date_trunc('hour',now())`;
      const [limit] =
        await tx`SELECT 1 FROM inquiry_rate_limits WHERE hour=date_trunc('hour',now()) AND ((scope=${scope} AND submissions>=5) OR (scope='all' AND submissions>=200)) LIMIT 1`;
      if (limit) return false;
      await tx`INSERT INTO inquiry_rate_limits(hour,scope,submissions) VALUES (date_trunc('hour',now()),${scope},1),(date_trunc('hour',now()),'all',1) ON CONFLICT(hour,scope) DO UPDATE SET submissions=inquiry_rate_limits.submissions+1`;
      await tx`INSERT INTO customer_inquiries(id,name,email,phone,answers) VALUES(${id},${name},${email},${phone},${tx.json(answers)})`;
      const receipt =
        await tx`INSERT INTO site_enquiries(id,payload) VALUES (${id},${tx.json({ name, email, phone, service: "Customer inquiry", message: answers.map((a) => a.label + "\n" + a.value).join("\n\n") })})
        ON CONFLICT DO NOTHING RETURNING id`;
      if (!receipt.length)
        throw new ApiFault(
          409,
          "CONFLICT",
          "This reference has already been used.",
        );
      await queueTrackingLink(tx, id);
      return true;
    });
    if (!accepted)
      return c.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: "Too many inquiries. Please try again in an hour.",
          },
        },
        429,
      );
    let context;
    try {
      context = c.executionCtx;
    } catch {
      /* Cron handles local calls without an execution context. */
    }
    context?.waitUntil(
      deliverTrackingLinks(c.env, fetch, id).catch(() =>
        console.warn("Tracking email queued for retry."),
      ),
    );
    return c.json({ received: true });
  } finally {
    await db.end();
  }
});
inquiries.get("/mine", authenticate, async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .safeParse(c.req.query("page") ?? 1);
  if (!page.success) throw new ApiFault(400, "INVALID_PAGE", "Invalid page.");
  const rows = await c.get("database")`WITH identity AS (
    SELECT lower(email) AS email FROM "user" WHERE id=${c.get("userId")} AND "emailVerified"
  ), mine AS (
    SELECT e.id,e.status,e.payload->>'service' AS service,e.received_at FROM site_enquiries e
      JOIN identity u ON lower(e.payload->>'email')=u.email
    UNION ALL
    SELECT i.id,CASE WHEN i.handled_at IS NULL THEN 'Received' ELSE 'Under review' END,'Customer inquiry',i.created_at
      FROM customer_inquiries i JOIN identity u ON lower(i.email)=u.email
      WHERE NOT EXISTS(SELECT 1 FROM site_enquiries e WHERE e.id=i.id AND lower(e.payload->>'email')=u.email)
  ) SELECT id,status,service,received_at::text AS received FROM mine ORDER BY received_at DESC,id DESC LIMIT 21 OFFSET ${(page.data - 1) * 20}`;
  return c.json({ items: rows.slice(0, 20), more: rows.length > 20 });
});
inquiries.use("*", authenticate, requirePermission("inquiries:manage"));
inquiries.get("/", async (c) => {
  const query = inquiryPageQuery.safeParse(c.req.query());
  if (!query.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid inquiry filter.");
  const { status, page } = query.data;
  const sql = c.get("database");
  const [count] =
    await sql`SELECT count(*)::int AS total FROM customer_inquiries WHERE (handled_at IS NULL)=${status === "new"}`;
  const items =
    await sql`SELECT id,name,email,phone,answers,contact_id AS "contactId",created_at AS "createdAt" FROM customer_inquiries WHERE (handled_at IS NULL)=${status === "new"} ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`;
  return c.json({ total: count.total, items });
});
inquiries.post("/:id/:action", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  const action = c.req.param("action");
  if (!id.success || !["handle", "convert"].includes(action))
    throw new ApiFault(404, "NOT_FOUND", "Inquiry not found.");
  if (action === "convert" && !allowed(c, "contacts:write"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Creating a contact requires contact write access.",
    );
  const result = await c.get("database").begin(async (tx) => {
    const [row] =
      await tx`SELECT * FROM customer_inquiries WHERE id=${id.data} FOR UPDATE`;
    if (!row) throw new ApiFault(404, "NOT_FOUND", "Inquiry not found.");
    await tx`UPDATE site_enquiries SET status='Under review',version=version+1 WHERE id=${id.data} AND status='Received' AND lower(payload->>'email')=lower(${row.email})`;
    if (action === "handle") {
      if (!row.handled_at) {
        await tx`UPDATE customer_inquiries SET handled_at=now() WHERE id=${id.data}`;
        await recordBusinessAudit(tx, c, "inquiry.handled", "inquiry", id.data);
      }
      return { contactId: row.contact_id };
    }
    if (row.contact_id) return { contactId: row.contact_id };
    const answers = storedInquiryAnswers.parse(row.answers);
    const data = contactInput.parse({
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: "",
      tags: [],
      status: "active",
      notes: answers
        .filter((a) => a.value)
        .map((a) => a.label + "\n" + a.value)
        .join("\n\n"),
    });
    const contactId = crypto.randomUUID();
    await tx`INSERT INTO contacts(id,data) VALUES(${contactId},${tx.json(data)})`;
    await tx`UPDATE customer_inquiries SET contact_id=${contactId},handled_at=coalesce(handled_at,now()) WHERE id=${id.data}`;
    await recordBusinessAudit(tx, c, "contact.created", "contact", contactId);
    await recordBusinessAudit(tx, c, "inquiry.converted", "inquiry", id.data);
    return { contactId };
  });
  return c.json(result);
});
