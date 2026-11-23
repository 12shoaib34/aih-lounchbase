import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";

const [userId, email, caseId, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
const valid =
  process.env.DATABASE_URL &&
  z.string().min(1).max(128).safeParse(userId).success &&
  z.email().safeParse(email).success &&
  z.uuid().safeParse(caseId).success &&
  new Set(flags).size === flags.length &&
  flags.every((flag) =>
    ["--apply", "--identity-verified", "--quiesced"].includes(flag),
  ) &&
  (apply ? flags.length === 3 : flags.length === 0);
if (!valid) {
  console.error(
    "Usage: npm run account:recover-mfa -- account-id expected-email case-uuid [--apply --identity-verified --quiesced]. Preview is default. Read docs/account-recovery.md first; DATABASE_URL required.",
  );
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  connection: { statement_timeout: 10000, lock_timeout: 5000 },
  onnotice: () => {},
});
try {
  // Never print, store in a file, or deliver the random replacement password.
  const replacement = apply
    ? await hashPassword(randomBytes(48).toString("base64url"))
    : null;
  const result = await sql.begin(async (tx) => {
    if (!apply) await tx`SET TRANSACTION READ ONLY`;
    else
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${caseId}, 8130))`;
    const [previous] =
      await tx`SELECT target_id FROM admin_audit_events WHERE action = 'account.mfa_recovered' AND request_id = ${caseId}`;
    if (previous) {
      if (previous.target_id !== userId)
        throw new Error("Case reference reused");
      return {
        mode: apply ? "apply" : "preview",
        status: "already-recorded",
        caseId,
      };
    }
    const query = tx`SELECT id, email, "emailVerified", "twoFactorEnabled" FROM "user" WHERE id = ${userId}`;
    const [user] = apply ? await tx`${query} FOR UPDATE` : await query;
    if (
      !user?.emailVerified ||
      !user.twoFactorEnabled ||
      user.email.toLowerCase() !== email.toLowerCase()
    )
      throw new Error("Exact verified enrolled account required");
    const accounts =
      await tx`SELECT id, "providerId" FROM account WHERE "userId" = ${userId}`;
    if (accounts.length !== 1 || accounts[0].providerId !== "credential")
      throw new Error("Only password accounts supported");
    if (!apply) return { mode: "preview", status: "eligible", caseId };
    await tx`UPDATE account SET password = ${replacement}, "updatedAt" = now() WHERE id = ${accounts[0].id}`;
    // Linked attempt counters contain a count rather than the account ID.
    await tx`DELETE FROM verification WHERE identifier IN (
      SELECT '2fa-attempts-' || identifier FROM verification WHERE value = ${userId} AND starts_with(identifier, '2fa-')
    )`;
    await tx`DELETE FROM verification WHERE value = ${userId}`;
    await tx`DELETE FROM "twoFactor" WHERE "userId" = ${userId}`;
    await tx`UPDATE "user" SET "twoFactorEnabled" = false, "updatedAt" = now() WHERE id = ${userId}`;
    await tx`DELETE FROM session WHERE "userId" = ${userId}`;
    await tx`INSERT INTO admin_audit_events (action, actor_type, target_type, target_id, request_id)
      VALUES ('account.mfa_recovered', 'operator', 'account', ${userId}, ${caseId})`;
    return { mode: "apply", status: "recovery-required", caseId };
  });
  // Success is emitted only after commit. No email, factor or credential output.
  console.log(JSON.stringify(result));
} catch {
  console.error(
    "MFA recovery failed. Check the database, migrations, exact verified account and unused case reference privately. Partial changes cannot commit; if commit acknowledgement was lost, inspect the audit case before retrying with the same reference.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
