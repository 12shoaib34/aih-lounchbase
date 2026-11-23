import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { authenticate, ApiFault, type AppEnv } from "./access";
import { hasPermission } from "../shared/access";
import {
  createRecord,
  updateRecord,
  listQuery,
  bulkArchive,
} from "../shared/records";

export const records = new Hono<AppEnv>();
records.use("*", authenticate, bodyLimit({ maxSize: 16384 }));
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check the highlighted fields.",
      z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
    );
  return parsed.data;
}
const projection =
  'id, title, status, version, created_at AS "createdAt", updated_at AS "updatedAt"';
records.get("/", async (c) => {
  const query = parse(listQuery, c.req.query());
  if (
    query.scope === "all" &&
    !hasPermission(c.get("permissions"), "records:read:any")
  )
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "You do not have access to all records.",
    );
  const sql = c.get("database");
  const where = sql`${query.scope === "all"} OR owner_id = ${c.get("userId")}`;
  // LIKE wildcards are escaped so search treats user input literally.
  const search = `%${query.search.replace(/[\\%_]/g, "\\$&")}%`;
  const filter = sql`(${where}) AND (${query.status === "all"} OR status = ${query.status}) AND title ILIKE ${search}`;
  const order =
    query.sort === "title"
      ? sql`title ASC, id ASC`
      : query.sort === "oldest"
        ? sql`created_at ASC, id ASC`
        : sql`created_at DESC, id DESC`;
  const [result] =
    await sql`SELECT count(*)::int AS total FROM reference_records WHERE ${filter}`;
  const items =
    await sql`SELECT ${sql.unsafe(projection)} FROM reference_records WHERE ${filter} ORDER BY ${order} LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`;
  return c.json({
    items,
    total: result.total,
    page: query.page,
    pageSize: query.pageSize,
  });
});
records.get("/:id", async (c) => {
  const id = parse(z.uuid(), c.req.param("id"));
  const sql = c.get("database");
  const [record] =
    await sql`SELECT ${sql.unsafe(projection)} FROM reference_records WHERE id = ${id} AND owner_id = ${c.get("userId")}`;
  if (!record)
    throw new ApiFault(404, "NOT_FOUND", "This record is no longer available.");
  return c.json(record);
});
records.post("/", async (c) => {
  const input = parse(createRecord, await c.req.json().catch(() => null));
  const sql = c.get("database");
  const [created] =
    await sql`INSERT INTO reference_records (id, owner_id, title, status) VALUES (${input.id}, ${c.get("userId")}, ${input.title}, ${input.status}) ON CONFLICT (id) DO NOTHING RETURNING ${sql.unsafe(projection)}`;
  if (created) return c.json(created, 201);
  const [existing] =
    await sql`SELECT ${sql.unsafe(projection)} FROM reference_records WHERE id = ${input.id} AND owner_id = ${c.get("userId")}`;
  if (
    !existing ||
    existing.title !== input.title ||
    existing.status !== input.status
  )
    throw new ApiFault(
      409,
      "CONFLICT",
      "This creation request has already been used. Reload and try again.",
    );
  return c.json(existing);
});
records.put("/:id", async (c) => {
  const id = parse(z.uuid(), c.req.param("id"));
  const input = parse(updateRecord, await c.req.json().catch(() => null));
  const sql = c.get("database");
  const [updated] =
    await sql`UPDATE reference_records SET title = ${input.title}, status = ${input.status}, version = version + 1, updated_at = now() WHERE id = ${id} AND owner_id = ${c.get("userId")} AND version = ${input.version} RETURNING ${sql.unsafe(projection)}`;
  if (!updated)
    throw new ApiFault(
      409,
      "CONFLICT",
      "This record changed or is no longer available. Reload before editing.",
    );
  return c.json(updated);
});
records.post("/archive", async (c) => {
  const input = parse(bulkArchive, await c.req.json().catch(() => null));
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    for (const item of [...input.items].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const rows =
        await tx`UPDATE reference_records SET status = 'archived', version = version + 1, updated_at = now() WHERE id = ${item.id} AND owner_id = ${c.get("userId")} AND version = ${item.version} RETURNING id`;
      if (!rows.length)
        throw new ApiFault(
          409,
          "CONFLICT",
          "Some records changed or are unavailable. Nothing was archived.",
        );
    }
  });
  return c.json({ updated: input.items.length });
});
