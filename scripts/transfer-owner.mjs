import postgres from "postgres";
import { randomUUID } from "node:crypto";

const [from, to, flag, ...extra] = process.argv.slice(2);
if (
  !process.env.DATABASE_URL ||
  !from ||
  !to ||
  from.toLowerCase() === to.toLowerCase() ||
  (flag && flag !== "--apply") ||
  extra.length
)
  throw new Error(
    "Usage: npm run owner:transfer -- current-owner-email verified-new-owner-email [--apply]. Preview is the default; DATABASE_URL is required.",
  );
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  connection: { statement_timeout: 10000 },
});
try {
  const message = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184624)`;
    await tx`SELECT pg_advisory_xact_lock(72184625)`;
    const users =
      await tx`SELECT id, lower(email) AS email, "emailVerified" FROM "user" WHERE lower(email) IN (${from.trim().toLowerCase()}, ${to.trim().toLowerCase()}) ORDER BY id FOR UPDATE`;
    const previous = users.find(
      (user) => user.email === from.trim().toLowerCase(),
    );
    const next = users.find((user) => user.email === to.trim().toLowerCase());
    const owners =
      await tx`SELECT user_id FROM team_members WHERE role = 'owner'`;
    if (
      !previous ||
      !next?.emailVerified ||
      owners.length !== 1 ||
      owners[0].user_id !== previous.id
    )
      throw new Error(
        "Transfer requires the exact current owner and a different existing, verified target account.",
      );
    if (!flag) {
      return "Preview passed. Applying will make the target the sole owner, remove the previous owner's team access, revoke both accounts' sessions, cancel old-owner pending invitations, and record both references in the audit trail. No changes made.";
    }
    await tx`DELETE FROM team_members WHERE user_id = ${previous.id}`;
    await tx`DELETE FROM user_permissions WHERE user_id IN (${previous.id}, ${next.id})`;
    await tx`INSERT INTO team_members (user_id, role) VALUES (${next.id}, 'owner') ON CONFLICT (user_id) DO UPDATE SET role = 'owner', version = team_members.version + 1`;
    await tx`DELETE FROM session WHERE "userId" IN (${previous.id}, ${next.id})`;
    await tx`UPDATE team_invitations SET revoked_at = now() WHERE invited_by = ${previous.id} AND accepted_at IS NULL AND revoked_at IS NULL`;
    const requestId = randomUUID();
    for (const [action, target] of [
      ["owner.transferred_out", previous.id],
      ["owner.transferred_in", next.id],
    ])
      await tx`INSERT INTO admin_audit_events (action, actor_type, target_type, target_id, request_id) VALUES (${action}, 'operator', 'account', ${target}, ${requestId})`;
    return "Ownership transferred. Both accounts must sign in again. Customer data was preserved.";
  });
  console.log(message);
} catch {
  console.error(
    "Ownership transfer failed. Verify the database target, exact current owner, verified target account, and applied migrations privately. Inspect the owner and audit records before retrying.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
