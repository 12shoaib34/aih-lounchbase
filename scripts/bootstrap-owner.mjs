import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
if (!process.env.DATABASE_URL || !email || process.argv.length !== 3) {
  throw new Error(
    "Usage: npm run owner:bootstrap -- verified-owner@example.com (DATABASE_URL required)",
  );
}
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const message = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184624)`;
    const [user] =
      await tx`SELECT id, "emailVerified" FROM "user" WHERE lower(email) = ${email} FOR UPDATE`;
    if (!user?.emailVerified)
      throw new Error(
        "The intended owner must register and verify their email first.",
      );
    const owners =
      await tx`SELECT user_id FROM team_members WHERE role = 'owner'`;
    if (owners.some((owner) => owner.user_id !== user.id))
      throw new Error(
        "An owner already exists. This command cannot transfer ownership.",
      );
    if (owners.some((owner) => owner.user_id === user.id)) {
      return "This verified account is already the owner. No changes made.";
    }
    await tx`INSERT INTO team_members (user_id, role) VALUES (${user.id}, 'owner') ON CONFLICT (user_id) DO UPDATE SET role = 'owner'`;
    await tx`INSERT INTO admin_audit_events (action, actor_type, target_type, target_id) VALUES ('owner.bootstrapped', 'operator', 'account', ${user.id})`;
    return "Verified account appointed as owner. No credentials were changed.";
  });
  console.log(message);
} finally {
  await sql.end();
}
