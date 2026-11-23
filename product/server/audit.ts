import type { TransactionSql } from "postgres";
import type { z } from "zod";
import { Hono, type Context } from "hono";
import { auditInput, auditQuery } from "../shared/audit";
import { ApiFault, authenticate, type AppEnv } from "./access";

/** Call inside the same transaction as the change. Never pass request bodies or secrets. */
export async function recordAudit(
  tx: TransactionSql,
  event: z.input<typeof auditInput>,
) {
  const data = auditInput.parse(event);
  // PostgreSQL canonicalizes UUID keys; audit references must use the same spelling.
  const targetId = ["account", "business", "payment-event"].includes(
    data.targetType,
  )
    ? data.targetId
    : data.targetId.toLowerCase();
  await tx`INSERT INTO admin_audit_events (action, actor_type, actor_id, target_type, target_id, request_id, before_permissions, after_permissions) VALUES (${data.action}, ${data.actorType}, ${data.actorId}, ${data.targetType}, ${targetId}, ${data.requestId}, ${data.beforePermissions ? tx.json(data.beforePermissions) : null}, ${data.afterPermissions ? tx.json(data.afterPermissions) : null})`;
}
/** Only authenticated route context supplies account attribution. */
export async function recordBusinessAudit(
  tx: TransactionSql,
  c: Context<AppEnv>,
  action: z.input<typeof auditInput>["action"],
  targetType: z.input<typeof auditInput>["targetType"],
  targetId: string,
) {
  await recordAudit(tx, {
    action,
    actorId: c.get("userId"),
    targetType,
    targetId,
    requestId: c.get("requestId"),
  });
}
export const audit = new Hono<AppEnv>();
audit.use("*", authenticate);
audit.get("/", async (c) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(
      403,
      "FORBIDDEN",
      "Only the owner can review the audit trail.",
    );
  const parsed = auditQuery.safeParse(c.req.query());
  if (!parsed.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check the event type, dates, and reference filters.",
    );
  const q = parsed.data;
  const sql = c.get("database");
  const rows =
    await sql`SELECT a.id::text, a.occurred_at AS "occurredAt", a.action, a.actor_type AS "actorType", a.actor_id AS "actorId", actor.name AS "actorName", a.target_type AS "targetType", a.target_id AS "targetId", CASE WHEN a.target_type = 'account' THEN target.name ELSE invitation.email END AS "targetName", a.request_id AS "requestId", a.before_permissions AS "beforePermissions", a.after_permissions AS "afterPermissions" FROM admin_audit_events a LEFT JOIN "user" actor ON a.actor_type = 'account' AND actor.id = a.actor_id LEFT JOIN "user" target ON a.target_type = 'account' AND target.id = a.target_id LEFT JOIN team_invitations invitation ON a.target_type = 'invitation' AND invitation.id::text = a.target_id WHERE (${q.action === "all"} OR a.action = ${q.action}) AND (${!q.actor} OR a.actor_id = ${q.actor ?? null}) AND (${!q.target} OR a.target_id = ${q.target ?? null}) AND (${!q.before} OR a.id < ${q.before ?? null}::bigint) AND (${!q.from} OR a.occurred_at >= ${q.from ? q.from + "T00:00:00Z" : null}::timestamptz) AND (${!q.to} OR a.occurred_at < ${q.to ? q.to + "T00:00:00Z" : null}::timestamptz + interval '24 hours') ORDER BY a.id DESC LIMIT 21`;
  const items = rows.slice(0, 20);
  return c.json({
    items,
    nextCursor: rows.length > 20 ? items.at(-1)!.id : null,
  });
});
