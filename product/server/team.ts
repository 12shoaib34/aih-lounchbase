import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { authenticate, ApiFault, type AppEnv } from "./access";
import { recordAudit } from "./audit";
import { createAuth } from "./auth";
import { invitationInput, grantsInput, acceptInput } from "../shared/team";

export const team = new Hono<AppEnv>();
team.use("*", authenticate, bodyLimit({ maxSize: 4096 }));
function parse<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Check the email, permissions, or request version. Module actions also require the corresponding view permission.",
    );
  return result.data;
}
async function digest(token: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
function unavailable() {
  return new ApiFault(
    409,
    "INVITATION_UNAVAILABLE",
    "This invitation is expired, used, cancelled, or belongs to another account.",
  );
}
// Acceptance is available to customers; all management routes below are owner-only.
team.post("/accept", async (c) => {
  if (c.env.TEAM_INVITES_ENABLED !== "true")
    throw new ApiFault(403, "DISABLED", "Team invitations are disabled.");
  const input = parse(acceptInput, await c.req.json().catch(() => null));
  const hash = await digest(input.token);
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const [invite] =
      await tx`SELECT * FROM team_invitations WHERE token_hash = ${hash} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() FOR UPDATE`;
    const [user] =
      await tx`SELECT email, "emailVerified" FROM "user" WHERE id = ${c.get("userId")} FOR UPDATE`;
    if (
      !invite ||
      !user?.emailVerified ||
      user.email.toLowerCase() !== invite.email
    )
      throw unavailable();
    const [inviter] =
      await tx`SELECT 1 FROM team_members WHERE user_id = ${invite.invited_by} AND role = 'owner'`;
    if (!inviter) throw unavailable();
    const existing =
      await tx`SELECT 1 FROM team_members WHERE user_id = ${c.get("userId")}`;
    if (existing.length)
      throw new ApiFault(
        409,
        "ALREADY_MEMBER",
        "This account is already on the team.",
      );
    const [count] = await tx`SELECT count(*)::int AS total FROM team_members`;
    if (count.total >= 200)
      throw new ApiFault(
        409,
        "TEAM_LIMIT",
        "The team member limit has been reached.",
      );
    const permissions = invitationInput.shape.permissions.parse(
      invite.permissions,
    );
    await tx`INSERT INTO team_members (user_id, role) VALUES (${c.get("userId")}, 'staff')`;
    await tx`DELETE FROM user_permissions WHERE user_id = ${c.get("userId")}`;
    for (const permission of permissions)
      await tx`INSERT INTO user_permissions (user_id, permission) VALUES (${c.get("userId")}, ${permission})`;
    await tx`UPDATE team_invitations SET accepted_at = now() WHERE id = ${invite.id}`;
    await recordAudit(tx, {
      action: "invitation.accepted",
      actorId: c.get("userId"),
      targetType: "invitation",
      targetId: invite.id,
      requestId: c.get("requestId"),
      afterPermissions: permissions,
    });
  });
  return c.json({ success: true });
});
team.use("*", async (c, next) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(403, "FORBIDDEN", "Only the owner can manage the team.");
  await next();
});
team.get("/", async (c) => {
  const sql = c.get("database");
  const members =
    await sql`SELECT m.user_id AS "userId", u.name, u.email, m.role, m.version, COALESCE((SELECT json_agg(p.permission ORDER BY p.permission) FROM user_permissions p WHERE p.user_id = m.user_id), '[]'::json) AS permissions FROM team_members m JOIN "user" u ON u.id = m.user_id ORDER BY m.created_at, m.user_id`;
  const invitations =
    await sql`SELECT id, email, permissions, expires_at AS "expiresAt" FROM team_invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC`;
  return c.json({
    members,
    invitations,
    invitationsEnabled: c.env.TEAM_INVITES_ENABLED === "true",
  });
});
team.post("/invitations", async (c) => {
  if (c.env.TEAM_INVITES_ENABLED !== "true")
    throw new ApiFault(403, "DISABLED", "Team invitations are disabled.");
  const input = parse(invitationInput, await c.req.json().catch(() => null));
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const hash = await digest(token);
  const id = crypto.randomUUID();
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const [user] =
      await tx`SELECT u.id, m.role FROM "user" u LEFT JOIN team_members m ON m.user_id = u.id WHERE lower(u.email) = ${input.email}`;
    if (user?.role)
      throw new ApiFault(
        409,
        "ALREADY_MEMBER",
        "This account is already on the team.",
      );
    if (!user && c.env.AUTH_ALLOW_SIGNUP !== "true")
      throw new ApiFault(
        409,
        "REGISTRATION_DISABLED",
        "This person needs an account before they can be invited while registration is closed.",
      );
    const [recent] =
      await tx`SELECT count(*)::int AS total FROM team_invitations WHERE created_at > now() - interval '1 hour'`;
    if (recent.total >= 10)
      throw new ApiFault(
        409,
        "INVITATION_LIMIT",
        "Invitation limit reached. Try again in an hour.",
      );
    const existing =
      await tx`SELECT 1 FROM team_invitations WHERE email = ${input.email} AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`;
    if (existing.length)
      throw new ApiFault(
        409,
        "INVITATION_PENDING",
        "An invitation is already pending for this address. Cancel it before sending another.",
      );
    await tx`INSERT INTO team_invitations (id, email, token_hash, permissions, invited_by, expires_at) VALUES (${id}, ${input.email}, ${hash}, ${tx.json(input.permissions)}, ${c.get("userId")}, now() + interval '48 hours')`;
    await recordAudit(tx, {
      action: "invitation.created",
      actorId: c.get("userId"),
      targetType: "invitation",
      targetId: id,
      requestId: c.get("requestId"),
      afterPermissions: input.permissions,
    });
  });
  const service = createAuth(c.env)!;
  try {
    await service.sendEmail(
      input.email,
      "Join your team",
      `${new URL("/app/invite", c.env.AUTH_BASE_URL).href}#${token}`,
    );
  } catch {
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(72184625)`;
      await tx`UPDATE team_invitations SET revoked_at = now() WHERE id = ${id}`;
      await recordAudit(tx, {
        action: "invitation.email_failed",
        actorId: c.get("userId"),
        targetType: "invitation",
        targetId: id,
        requestId: c.get("requestId"),
      });
    });
    throw new ApiFault(
      503,
      "EMAIL_FAILED",
      "The invitation could not be sent. Please try again.",
    );
  } finally {
    await service.close();
  }
  await sql.begin((tx) =>
    recordAudit(tx, {
      action: "invitation.email_accepted",
      actorId: c.get("userId"),
      targetType: "invitation",
      targetId: id,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ success: true }, 201);
});
team.delete("/invitations/:id", async (c) => {
  const id = parse(z.uuid(), c.req.param("id"));
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const rows =
      await tx`UPDATE team_invitations SET revoked_at = now() WHERE id = ${id} AND accepted_at IS NULL AND revoked_at IS NULL RETURNING id`;
    if (!rows.length) throw unavailable();
    await recordAudit(tx, {
      action: "invitation.cancelled",
      actorId: c.get("userId"),
      targetType: "invitation",
      targetId: id,
      requestId: c.get("requestId"),
    });
  });
  return c.json({ success: true });
});
team.put("/members/:id", async (c) => {
  const input = parse(grantsInput, await c.req.json().catch(() => null));
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const previous =
      await tx`SELECT permission FROM user_permissions WHERE user_id = ${c.req.param("id")} ORDER BY permission`;
    const rows =
      await tx`UPDATE team_members SET version = version + 1 WHERE user_id = ${c.req.param("id")} AND role = 'staff' AND version = ${input.version} RETURNING user_id`;
    if (!rows.length)
      throw new ApiFault(
        409,
        "CONFLICT",
        "This member changed or cannot be edited. Reload the team.",
      );
    await tx`DELETE FROM user_permissions WHERE user_id = ${c.req.param("id")}`;
    for (const permission of input.permissions)
      await tx`INSERT INTO user_permissions (user_id, permission) VALUES (${c.req.param("id")}, ${permission})`;
    await recordAudit(tx, {
      action: "member.permissions_changed",
      actorId: c.get("userId"),
      targetType: "account",
      targetId: c.req.param("id"),
      requestId: c.get("requestId"),
      beforePermissions: previous.map((row) => row.permission),
      afterPermissions: input.permissions,
    });
  });
  return c.json({ success: true });
});
team.delete("/members/:id", async (c) => {
  const input = parse(
    z.object({ version: z.number().int().positive() }),
    await c.req.json().catch(() => null),
  );
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const previous =
      await tx`SELECT permission FROM user_permissions WHERE user_id = ${c.req.param("id")} ORDER BY permission`;
    const rows =
      await tx`DELETE FROM team_members WHERE user_id = ${c.req.param("id")} AND role = 'staff' AND version = ${input.version} RETURNING user_id`;
    if (!rows.length)
      throw new ApiFault(
        409,
        "CONFLICT",
        "This member changed or cannot be removed. Reload the team.",
      );
    await tx`DELETE FROM user_permissions WHERE user_id = ${c.req.param("id")}`;
    await recordAudit(tx, {
      action: "member.removed",
      actorId: c.get("userId"),
      targetType: "account",
      targetId: c.req.param("id"),
      requestId: c.get("requestId"),
      beforePermissions: previous.map((row) => row.permission),
      afterPermissions: [],
    });
  });
  return c.json({ success: true });
});
