import { Hono } from "hono";
import { z } from "zod";
import {
  authenticate,
  allowed,
  requirePermission,
  ApiFault,
  type AppEnv,
} from "./access";

export const admin = new Hono<AppEnv>();
admin.use("*", authenticate);
admin.get("/", (c) => {
  if (c.get("mfaRequired"))
    return c.json({
      userId: c.get("userId"),
      teamRole: null,
      permissions: [],
      mfaRequired: true,
    });
  if (!c.get("teamRole"))
    throw new ApiFault(403, "FORBIDDEN", "Team access is required.");
  return c.json({
    userId: c.get("userId"),
    teamRole: c.get("teamRole"),
    permissions: c.get("permissions"),
  });
});
admin.get("/users", requirePermission("users:read"), async (c) => {
  const parsed = z
    .object({
      page: z.coerce.number().int().min(1).max(10000).default(1),
      search: z.string().trim().max(100).default(""),
    })
    .safeParse(c.req.query());
  if (!parsed.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid search or page.");
  const { page, search } = parsed.data;
  const sql = c.get("database");
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const filter = sql`(u.name ILIKE ${pattern} OR u.email ILIKE ${pattern})`;
  const [count] =
    await sql`SELECT count(*)::int AS total FROM "user" u WHERE ${filter}`;
  const items =
    await sql`SELECT u.id, u.name, u.email, u."emailVerified", m.role AS "teamRole" FROM "user" u LEFT JOIN team_members m ON m.user_id = u.id WHERE ${filter} ORDER BY u."createdAt" DESC, u.id LIMIT 20 OFFSET ${(page - 1) * 20}`;
  return c.json({ items, total: count.total, page, pageSize: 20 });
});

admin.get("/account-choices", async (c) => {
  const input = z
    .object({
      purpose: z.enum(["billing", "notifications"]),
      search: z.string().trim().max(100).default(""),
    })
    .safeParse(c.req.query());
  if (!input.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid account lookup.");
  const required =
    input.data.purpose === "billing" ? "billing:create" : "notifications:write";
  if (
    !allowed(c, required) &&
    !(input.data.purpose === "billing" && allowed(c, "billing:edit"))
  )
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "You do not have access to this account lookup.",
    );
  const pattern = `%${input.data.search.replace(/[\\%_]/g, "\\$&")}%`;
  const items = await c.get(
    "database",
  )`SELECT id, name, email FROM "user" WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} ORDER BY name, id LIMIT 20`;
  return c.json({ items });
});
