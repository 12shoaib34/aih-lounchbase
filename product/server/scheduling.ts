import { recordBusinessAudit } from "./audit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { authenticate, allowed, ApiFault, type AppEnv } from "./access";
import { resourceInput, bookingInput, withinHours } from "../shared/scheduling";

export const scheduling = new Hono<AppEnv>();
scheduling.use("*", authenticate);
scheduling.get("/resources", async (c) =>
  c.json({
    items: await c.get(
      "database",
    )`SELECT id, data FROM scheduling_resources ORDER BY created_at, id LIMIT 100`,
  }),
);
scheduling.post("/resources", bodyLimit({ maxSize: 8192 }), async (c) => {
  if (!allowed(c, "scheduling:resources"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Resource creation permission is required.",
    );
  const parsed = z
    .object({ id: z.uuid(), data: resourceInput })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check the resource name, timezone and opening periods.",
    );
  const { id, data } = parsed.data;
  const sql = c.get("database");
  const row = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184630)`;
    const [existing] =
      await tx`SELECT id FROM scheduling_resources WHERE id = ${id} AND data = ${tx.json(data)}::jsonb`;
    if (existing) return existing;
    const [count] =
      await tx`SELECT count(*)::int AS total FROM scheduling_resources`;
    if (count.total >= 100)
      throw new ApiFault(
        400,
        "LIMIT",
        "This module supports up to 100 resources.",
      );
    const [created] =
      await tx`INSERT INTO scheduling_resources (id, data) VALUES (${id}, ${tx.json(data)}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!created)
      throw new ApiFault(409, "CONFLICT", "This resource ID was already used.");
    await recordBusinessAudit(tx, c, "resource.created", "resource", id);
    return created;
  });
  return c.json(row);
});
scheduling.get("/bookings", async (c) => {
  const all = c.req.query("scope") === "all";
  if (all && !allowed(c, "scheduling:read"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Booking review permission is required.",
    );
  const items = await c.get(
    "database",
  )`SELECT b.id, resource_id AS "resourceId", r.data->>'name' AS "resourceName", starts_at::text AS "startsAt", ends_at::text AS "endsAt", status FROM bookings b JOIN scheduling_resources r ON r.id = b.resource_id WHERE (${all} OR customer_id = ${c.get("userId")}) ORDER BY starts_at DESC, b.id LIMIT 100`;
  return c.json({ items });
});
scheduling.post("/bookings", bodyLimit({ maxSize: 4096 }), async (c) => {
  const parsed = bookingInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check the resource and booking times.",
    );
  const { id, resourceId, startsAt, endsAt } = parsed.data;
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const duration = end.getTime() - start.getTime();
  const sql = c.get("database");
  const result = await sql.begin(async (tx) => {
    // One row lock serializes all reservations for a resource, including simultaneous customers.
    const [resource] =
      await tx`SELECT data FROM scheduling_resources WHERE id = ${resourceId} FOR UPDATE`;
    if (!resource) throw new ApiFault(404, "NOT_FOUND", "Resource not found.");
    const [existing] =
      await tx`SELECT id, status, customer_id, resource_id, starts_at, ends_at FROM bookings WHERE id = ${id}`;
    if (existing) {
      if (
        existing.customer_id === c.get("userId") &&
        existing.resource_id === resourceId &&
        new Date(existing.starts_at).getTime() === start.getTime() &&
        new Date(existing.ends_at).getTime() === end.getTime()
      )
        return { id, status: existing.status };
      throw new ApiFault(
        409,
        "CONFLICT",
        "This booking request was already used.",
      );
    }
    if (
      start.getTime() <= Date.now() ||
      start.getTime() > Date.now() + 180 * 86400000 ||
      duration < 15 * 60000 ||
      duration > 8 * 3600000 ||
      start.getSeconds() ||
      end.getSeconds() ||
      start.getMilliseconds() ||
      end.getMilliseconds()
    )
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Choose a future booking within 180 days, lasting 15 minutes to 8 hours, at whole-minute times.",
      );
    if (!withinHours(start, end, resourceInput.parse(resource.data)))
      throw new ApiFault(
        400,
        "OUTSIDE_HOURS",
        "The selected times are outside this resource's opening hours.",
      );
    const [conflict] =
      await tx`SELECT id FROM bookings WHERE resource_id = ${resourceId} AND status = 'confirmed' AND starts_at < ${endsAt} AND ends_at > ${startsAt} LIMIT 1`;
    if (conflict)
      throw new ApiFault(
        409,
        "UNAVAILABLE",
        "That time is already booked. Choose another time.",
      );
    const [created] =
      await tx`INSERT INTO bookings (id, resource_id, customer_id, starts_at, ends_at) VALUES (${id}, ${resourceId}, ${c.get("userId")}, ${startsAt}, ${endsAt}) ON CONFLICT DO NOTHING RETURNING id, status`;
    if (!created)
      throw new ApiFault(
        409,
        "CONFLICT",
        "This booking request was already used.",
      );
    await recordBusinessAudit(tx, c, "booking.created", "booking", id);
    return created;
  });
  return c.json(result);
});
scheduling.post("/bookings/:id/cancel", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Booking not found.");
  await c.get("database").begin(async (tx) => {
    const [booking] =
      await tx`SELECT status FROM bookings WHERE id = ${id.data} AND (customer_id = ${c.get("userId")} OR ${allowed(c, "scheduling:cancel")}) FOR UPDATE`;
    if (!booking) throw new ApiFault(404, "NOT_FOUND", "Booking not found.");
    if (booking.status === "cancelled") return;
    await tx`UPDATE bookings SET status = 'cancelled' WHERE id = ${id.data}`;
    await recordBusinessAudit(tx, c, "booking.cancelled", "booking", id.data);
  });
  return c.body(null, 204);
});
