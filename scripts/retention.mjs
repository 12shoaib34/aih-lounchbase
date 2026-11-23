import postgres from "postgres";

const args = process.argv.slice(2);
if (
  !process.env.DATABASE_URL ||
  args.length > 1 ||
  (args[0] && args[0] !== "--apply")
)
  throw new Error(
    "Usage: npm run data:retention -- [--apply]. Preview is the default; DATABASE_URL is required.",
  );
const apply = args[0] === "--apply";
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 5,
  connection: { statement_timeout: 10000 },
});
// Fixed predicates only. These are operational expiry defaults, not a legal retention policy.
const rules = [
  ["expiredSessions", '"session"', "\"expiresAt\" < now() - interval '7 days'"],
  [
    "expiredVerifications",
    '"verification"',
    "\"expiresAt\" < now() - interval '7 days'",
  ],
  [
    "oldRateLimits",
    '"rateLimit"',
    "\"lastRequest\" < (extract(epoch from now() - interval '1 day') * 1000)::bigint",
  ],
  [
    "localMailOutbox",
    "auth_mail_outbox",
    "created_at < now() - interval '7 days'",
  ],
  [
    "finishedNotifications",
    "notification_jobs",
    "NOT EXISTS (SELECT 1 FROM mail_jobs m WHERE m.id = notification_jobs.id AND m.state IN ('pending', 'processing', 'failed')) AND ((state = 'cancelled' AND created_at < now() - interval '90 days') OR (state = 'delivered' AND EXISTS (SELECT 1 FROM notifications n WHERE n.id = notification_jobs.id AND n.read_at < now() - interval '90 days')))",
  ],
];
try {
  const counts = await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184640)`;
    const result = {};
    for (const [label, table, predicate] of rules) {
      const [row] = await tx.unsafe(
        apply
          ? `WITH removed AS (DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} WHERE ${predicate} LIMIT 500) RETURNING id) SELECT count(*)::int AS count FROM removed`
          : `SELECT count(*)::int AS count FROM (SELECT id FROM ${table} WHERE ${predicate} LIMIT 500) eligible`,
      );
      result[label] = row.count;
    }
    return result;
  });
  console.log(
    JSON.stringify(
      {
        mode: apply ? "applied" : "preview",
        batchLimitPerCategory: 500,
        counts,
        note: "Counts are capped at 500 per category. Audit, contacts, files, bookings, accounts, and unread notifications are not purged.",
      },
      null,
      2,
    ),
  );
} catch {
  console.error(
    "Retention check failed. Verify database access and migrations privately. No transaction changes were committed.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
