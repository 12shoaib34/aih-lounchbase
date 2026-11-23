import { recordBusinessAudit } from "./audit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
  ApiFault,
  allowed,
  type AppEnv,
} from "./access";
import { contactInput, contactListQuery } from "../shared/contacts";
import { writeContactCsv } from "../shared/contact-csv";

export const contacts = new Hono<AppEnv>();
contacts.use("*", authenticate, requirePermission("contacts:read"));
contacts.get("/", async (c) => {
  const parsed = contactListQuery.safeParse(c.req.query());
  if (!parsed.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid contact filters.");
  const { search, page, status } = parsed.data;
  const db = c.get("databasePool");
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  const filter = `(data->>'name' ILIKE $1 OR data->>'email' ILIKE $1 OR data->>'company' ILIKE $1 OR data->>'legalName' ILIKE $1 OR data->>'phone' ILIKE $1) AND ($2::text = 'all' OR data->>'status' = $2)`;
  const {
    rows: [count],
  } = await db.query(
    `SELECT count(*)::int AS total FROM contacts WHERE ${filter}`,
    [pattern, status],
  );
  const { rows: items } = await db.query(
    `SELECT id, data, version FROM contacts WHERE ${filter} ORDER BY created_at DESC, id LIMIT 20 OFFSET $3`,
    [pattern, status, (page - 1) * 20],
  );
  return c.json({ items, total: count.total, page });
});
contacts.post(
  "/",
  requirePermission("contacts:write"),
  bodyLimit({ maxSize: 16384 }),
  async (c) => {
    const parsed = z
      .object({ id: z.uuid(), data: contactInput })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Check the contact fields.");
    const sql = c.get("database");
    const { id, data } = parsed.data;
    const result = await sql.begin(async (tx) => {
      const [inserted] =
        await tx`INSERT INTO contacts (id, data) VALUES (${id}, ${tx.json(data)}) ON CONFLICT DO NOTHING RETURNING id, data, version`;
      if (inserted) {
        await recordBusinessAudit(tx, c, "contact.created", "contact", id);
        return { row: inserted, created: true };
      }
      const [existing] =
        await tx`SELECT id, data, version FROM contacts WHERE id = ${id} AND (jsonb_build_object('legalName', '', 'billingAddress', '') || data) = ${tx.json(data)}::jsonb`;
      if (!existing)
        throw new ApiFault(
          409,
          "CONFLICT",
          "This contact creation was already used with different details.",
        );
      return { row: existing, created: false };
    });
    return c.json(result.row, result.created ? 201 : 200);
  },
);
contacts.get("/export", requirePermission("contacts:export"), async (c) => {
  const rows = await c.get(
    "database",
  )`SELECT data FROM contacts ORDER BY created_at DESC, id LIMIT 1001`;
  if (rows.length > 1000)
    throw new ApiFault(
      400,
      "EXPORT_LIMIT",
      "This export supports up to 1000 contacts. Ask the operator for a larger export.",
    );
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", 'attachment; filename="contacts.csv"');
  return c.body(
    writeContactCsv(rows.map((row) => contactInput.parse(row.data))),
  );
});
contacts.post(
  "/import",
  requirePermission("contacts:import"),
  bodyLimit({ maxSize: 1048576 }),
  async (c) => {
    const parsed = z
      .object({
        items: z
          .array(z.object({ id: z.uuid(), data: contactInput }))
          .min(1)
          .max(500),
      })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Import 1–500 valid contacts, with a unique ID for each row.",
      );
    const { items } = parsed.data;
    if (
      new Set(items.map((item) => item.id)).size !== items.length ||
      new Set(items.map((item) => JSON.stringify(item.data))).size !==
        items.length
    )
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Duplicate rows or IDs in import.",
      );
    const result = await c.get("database").begin(async (tx) => {
      let inserted = 0;
      // Stable ordering prevents concurrent retry batches locking IDs in different orders.
      for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
        const rows =
          await tx`INSERT INTO contacts (id, data) VALUES (${item.id}, ${tx.json(item.data)}) ON CONFLICT DO NOTHING RETURNING id`;
        if (rows.length) {
          inserted++;
          await recordBusinessAudit(
            tx,
            c,
            "contact.imported",
            "contact",
            item.id,
          );
        } else {
          const [same] =
            await tx`SELECT id FROM contacts WHERE id = ${item.id} AND (jsonb_build_object('legalName', '', 'billingAddress', '') || data) = ${tx.json(item.data)}::jsonb`;
          if (!same)
            throw new ApiFault(
              409,
              "CONFLICT",
              "An imported row changed. No rows from this attempt were committed.",
            );
        }
      }
      return { inserted, unchanged: items.length - inserted };
    });
    return c.json(result);
  },
);
// Separate contact access is mandatory; selecting a recipient never links an account.
contacts.get("/invoice-choices", async (c) => {
  if (!allowed(c, "billing:create") && !allowed(c, "billing:edit"))
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Invoice creation or editing access is required.",
    );
  const search = z
    .string()
    .trim()
    .max(100)
    .safeParse(c.req.query("search") ?? "");
  if (!search.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Use a shorter contact search.",
    );
  const pattern = `%${search.data.replace(/[\\%_]/g, "\\$&")}%`;
  const { rows: items } = await c.get("databasePool").query(
    `SELECT id, data->>'name' AS name, data->>'company' AS company,
      COALESCE(data->>'legalName', '') AS "legalName", data->>'email' AS email,
      COALESCE(data->>'billingAddress', '') AS "billingAddress"
     FROM contacts WHERE data->>'status' = 'active'
       AND (data->>'name' ILIKE $1 OR data->>'company' ILIKE $1 OR data->>'legalName' ILIKE $1 OR data->>'email' ILIKE $1 OR data->>'phone' ILIKE $1)
     ORDER BY lower(data->>'name'), id LIMIT 20`,
    [pattern],
  );
  return c.json({ items });
});

// Fixed /export is registered first and keeps its separate permission check.
contacts.get("/:id", async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "Contact not found.");
  const {
    rows: [contact],
  } = await c
    .get("databasePool")
    .query("SELECT id, data, version FROM contacts WHERE id = $1", [id.data]);
  if (!contact) throw new ApiFault(404, "NOT_FOUND", "Contact not found.");
  return c.json(contact);
});
contacts.put(
  "/:id",
  requirePermission("contacts:write"),
  bodyLimit({ maxSize: 16384 }),
  async (c) => {
    const id = z.uuid().safeParse(c.req.param("id"));
    const parsed = z
      .object({ data: contactInput, version: z.number().int().positive() })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !id.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Check the contact fields.");
    const sql = c.get("database");
    const row = await sql.begin(async (tx) => {
      const [row] =
        await tx`UPDATE contacts SET data = ${tx.json(parsed.data.data)}, version = version + 1, updated_at = now() WHERE id = ${id.data} AND version = ${parsed.data.version} RETURNING id, data, version`;
      if (!row)
        throw new ApiFault(
          409,
          "CONFLICT",
          "Contact changed elsewhere. Your draft has not been saved. Load the latest contact before editing again.",
        );
      await recordBusinessAudit(tx, c, "contact.updated", "contact", id.data);
      return row;
    });
    return c.json(row);
  },
);
