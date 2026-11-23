import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
  ApiFault,
  type AppEnv,
} from "./access";
import { notificationEmail } from "./email-templates";
import { deliverMailJobs } from "./mail-jobs";
import { notificationInput } from "../shared/notifications";
import { connectDatabase, type DatabaseBindings } from "./database";

// PostgreSQL-only delivery is atomic: a crash rolls back both the inbox insert and job completion.
// External email delivery uses a separate leased queue.
export async function deliverNotifications(bindings: DatabaseBindings) {
  const sql = connectDatabase(bindings);
  try {
    return await sql.begin(async (tx) => {
      const rows =
        await tx`SELECT id, recipient_id, title, body FROM notification_jobs WHERE state = 'pending' AND due_at <= now() ORDER BY due_at, id LIMIT 50 FOR UPDATE SKIP LOCKED`;
      for (const row of rows) {
        await tx`INSERT INTO notifications (id, recipient_id, title, body) VALUES (${row.id}, ${row.recipient_id}, ${row.title}, ${row.body}) ON CONFLICT DO NOTHING`;
        await tx`UPDATE notification_jobs SET state = 'delivered', delivered_at = now() WHERE id = ${row.id}`;
      }
      return rows.length;
    });
  } finally {
    await sql.end();
  }
}
export const notifications = new Hono<AppEnv>();
notifications.use("*", authenticate);
notifications.get("/preferences", async (c) => {
  const [row] = await c.get(
    "database",
  )`SELECT email_enabled AS email FROM notification_preferences WHERE user_id = ${c.get("userId")}`;
  return c.json({ email: row?.email ?? false });
});
notifications.put("/preferences", bodyLimit({ maxSize: 1024 }), async (c) => {
  const parsed = z
    .object({ email: z.boolean() })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Choose an email preference.");
  await c.get(
    "database",
  )`INSERT INTO notification_preferences (user_id, email_enabled) VALUES (${c.get("userId")}, ${parsed.data.email}) ON CONFLICT (user_id) DO UPDATE SET email_enabled = EXCLUDED.email_enabled`;
  return c.json(parsed.data);
});
notifications.get("/", async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(c.req.query("page") ?? 1);
  if (!page.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid notification page.");
  const sql = c.get("database");
  const [count] =
    await sql`SELECT count(*)::int AS total FROM notifications WHERE recipient_id = ${c.get("userId")}`;
  const items =
    await sql`SELECT id, title, body, created_at::text AS "createdAt", read_at IS NOT NULL AS read FROM notifications WHERE recipient_id = ${c.get("userId")} ORDER BY created_at DESC, id LIMIT 20 OFFSET ${(page.data - 1) * 20}`;
  return c.json({ items, total: count.total, page: page.data });
});
notifications.post("/:id/read", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success)
    throw new ApiFault(404, "NOT_FOUND", "Notification not found.");
  const rows = await c.get(
    "database",
  )`UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = ${id.data} AND recipient_id = ${c.get("userId")} RETURNING id`;
  if (!rows.length)
    throw new ApiFault(404, "NOT_FOUND", "Notification not found.");
  return c.body(null, 204);
});
export const notificationJobs = new Hono<AppEnv>();
notificationJobs.use(
  "*",
  authenticate,
  requirePermission("notifications:read"),
);
notificationJobs.get("/email-review", async (c) => {
  const input = z
    .object({
      page: z.coerce.number().int().min(1).max(10000),
      filter: z.enum(["failed", "all"]),
    })
    .safeParse({
      page: c.req.query("page") ?? 1,
      filter: c.req.query("filter") ?? "failed",
    });
  if (!input.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid email review filter.");
  const { page, filter } = input.data;
  const sql = c.get("database");
  const [count] =
    await sql`SELECT count(*)::int AS total FROM mail_jobs WHERE (${filter} = 'all' OR state = 'failed')`;
  const items =
    await sql`SELECT m.id, n.title, m.recipient_id AS "recipientId", m.state, m.attempts, m.last_result AS "lastResult", m.next_attempt_at::text AS "nextAttemptAt", m.first_attempt_at::text AS "firstAttemptAt", m.reviewed_at::text AS "reviewedAt", m.reviewed_by AS "reviewedBy", COALESCE(m.first_attempt_at < now() - interval '23 hours', false) AS "retryWindowExpired" FROM mail_jobs m JOIN notification_jobs n ON n.id = m.id WHERE (${filter} = 'all' OR m.state = 'failed') ORDER BY m.created_at DESC, m.id LIMIT 20 OFFSET ${(page - 1) * 20}`;
  return c.json({ items, total: count.total, page });
});
notificationJobs.get("/:id/email-attempts", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Email job not found.");
  const sql = c.get("database");
  const [job] = await sql`SELECT id FROM mail_jobs WHERE id = ${id.data}`;
  if (!job) throw new ApiFault(404, "NOT_FOUND", "Email job not found.");
  const items =
    await sql`SELECT attempt, started_at::text AS "startedAt", finished_at::text AS "finishedAt", outcome FROM mail_attempts WHERE job_id = ${id.data} ORDER BY attempt LIMIT 5`;
  return c.json({ items });
});
notificationJobs.post(
  "/email-review/process",
  requirePermission("notifications:deliver"),
  async (c) => c.json({ accepted: await deliverMailJobs(c.env) }),
);
notificationJobs.post(
  "/:id/email-review",
  requirePermission("notifications:review"),
  bodyLimit({ maxSize: 1024 }),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param("id"));
    const input = z
      .object({ attempts: z.number().int().min(0).max(5) })
      .safeParse(await c.req.json().catch(() => null));
    if (!id.success || !input.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Invalid review request.");
    const rows = await c.get(
      "database",
    )`UPDATE mail_jobs SET reviewed_by = CASE WHEN reviewed_at IS NULL THEN ${c.get("userId")} ELSE reviewed_by END, reviewed_at = COALESCE(reviewed_at, now()) WHERE id = ${id.data} AND state = 'failed' AND attempts = ${input.data.attempts} RETURNING id`;
    if (!rows.length)
      throw new ApiFault(
        409,
        "CONFLICT",
        "Only an unchanged failed email can be marked reviewed. Refresh the list.",
      );
    return c.body(null, 204);
  },
);
notificationJobs.get("/", async (c) => {
  const items = await c.get(
    "database",
  )`SELECT n.id, n.title, n.recipient_id AS "recipientId", n.due_at::text AS "dueAt", n.state, m.state AS "emailState" FROM notification_jobs n LEFT JOIN mail_jobs m ON m.id = n.id ORDER BY n.created_at DESC, n.id LIMIT 100`;
  return c.json({ items });
});
notificationJobs.post(
  "/",
  requirePermission("notifications:write"),
  bodyLimit({ maxSize: 8192 }),
  async (c) => {
    const parsed = notificationInput.safeParse(
      await c.req.json().catch(() => null),
    );
    if (!parsed.success)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Check recipient, title, message and delivery date.",
      );
    const { id, recipientId, title, body, dueAt, email } = parsed.data;
    const sql = c.get("database");
    const result = await sql.begin(async (tx) => {
      const [user] =
        await tx`SELECT id, email, "emailVerified" FROM "user" WHERE id = ${recipientId} FOR KEY SHARE`;
      if (!user)
        throw new ApiFault(
          400,
          "VALIDATION_ERROR",
          "Recipient account does not exist.",
        );
      await tx`INSERT INTO notification_jobs (id, recipient_id, title, body, due_at, email_requested) VALUES (${id}, ${recipientId}, ${title}, ${body}, ${dueAt}, ${email}) ON CONFLICT DO NOTHING`;
      const [row] =
        await tx`SELECT id FROM notification_jobs WHERE id = ${id} AND recipient_id = ${recipientId} AND title = ${title} AND body = ${body} AND due_at = ${dueAt} AND email_requested = ${email}`;
      if (!row)
        throw new ApiFault(
          409,
          "CONFLICT",
          "This notification request was already used.",
        );
      if (email) {
        const [preference] =
          await tx`SELECT email_enabled FROM notification_preferences WHERE user_id = ${recipientId}`;
        const url = new URL("/app/account/notifications", c.env.AUTH_BASE_URL!)
          .href;
        const template = notificationEmail(title, body, url);
        const state =
          user.emailVerified && preference?.email_enabled
            ? "pending"
            : "cancelled";
        await tx`INSERT INTO mail_jobs (id, recipient_id, recipient_email, subject, body, html, url, state) VALUES (${id}, ${recipientId}, ${user.email}, ${template.subject}, ${template.text}, ${template.html}, ${url}, ${state}) ON CONFLICT DO NOTHING`;
      }
      return row;
    });
    return c.json(result);
  },
);
notificationJobs.post(
  "/deliver",
  requirePermission("notifications:deliver"),
  async (c) => {
    const delivered = await deliverNotifications(c.env);
    return c.json({ delivered, emailAccepted: await deliverMailJobs(c.env) });
  },
);
notificationJobs.post(
  "/:id/cancel",
  requirePermission("notifications:write"),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param("id"));
    if (!id.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Invalid job.");
    await c.get("database").begin(async (tx) => {
      const rows =
        await tx`UPDATE notification_jobs SET state = 'cancelled' WHERE id = ${id.data} AND state = 'pending' RETURNING id`;
      if (!rows.length)
        throw new ApiFault(
          409,
          "CONFLICT",
          "Only pending notifications can be cancelled.",
        );
      await tx`UPDATE mail_jobs SET state = 'cancelled' WHERE id = ${id.data} AND state = 'pending'`;
    });
    return c.body(null, 204);
  },
);
