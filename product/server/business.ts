import { recordBusinessAudit } from "./audit";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { authenticate, ApiFault, type AppEnv } from "./access";
import { businessUpdate } from "../shared/business";

export const business = new Hono<AppEnv>();
business.use("*", authenticate, async (c, next) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Only the owner can manage business settings.",
    );
  await next();
});
business.get("/", async (c) => {
  const {
    rows: [row],
  } = await c
    .get("databasePool")
    .query("SELECT data, version FROM business_settings WHERE singleton");
  return c.json(row ?? { data: null, version: 0 });
});
business.put("/", bodyLimit({ maxSize: 524288 }), async (c) => {
  const parsed = businessUpdate.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Check business settings.",
    );
  const { data, version } = parsed.data;
  const sql = c.get("database");
  const rows = await sql.begin(async (tx) => {
    const rows =
      version === 0
        ? await tx`INSERT INTO business_settings (data, updated_by) VALUES (${tx.json(data)}, ${c.get("userId")}) ON CONFLICT DO NOTHING RETURNING data, version`
        : await tx`UPDATE business_settings SET data = ${tx.json(data)}, version = version + 1, updated_by = ${c.get("userId")}, updated_at = now() WHERE singleton AND version = ${version} RETURNING data, version`;
    if (!rows.length)
      throw new ApiFault(
        409,
        "CONFLICT",
        "Settings changed elsewhere. Reload the latest settings before saving.",
      );
    await recordBusinessAudit(
      tx,
      c,
      "business.updated",
      "business",
      "settings",
    );
    return rows;
  });
  return c.json(rows[0]);
});
