import { connectDatabase } from "./database";
import { authConfiguration, type AuthBindings } from "./auth-configuration";

export async function deliverMailJobs(env: AuthBindings) {
  if (!authConfiguration(env))
    throw new Error("Email delivery requires configured accounts.");
  const sql = connectDatabase(env);
  const token = crypto.randomUUID();
  try {
    const jobs = await sql.begin(async (tx) => {
      // Bounded cleanup and the claim predicate both enforce the retry window.
      const expired =
        await tx`SELECT id, attempts, first_attempt_at < now() - interval '23 hours' AS stale FROM mail_jobs WHERE (state = 'processing' AND lease_until < now() AND attempts >= 5) OR (state IN ('pending', 'processing') AND first_attempt_at < now() - interval '23 hours') ORDER BY created_at, id LIMIT 50 FOR UPDATE SKIP LOCKED`;
      for (const job of expired) {
        await tx`UPDATE mail_attempts SET outcome = 'lease_expired', finished_at = now() WHERE job_id = ${job.id} AND outcome = 'processing'`;
        await tx`UPDATE mail_jobs SET state = 'failed', last_result = ${job.stale ? "retry_window_expired" : "attempt_limit"}, lease_token = NULL, lease_until = NULL WHERE id = ${job.id}`;
      }
      const claimed =
        await tx`WITH candidates AS (SELECT m.id FROM mail_jobs m JOIN notification_jobs n ON n.id = m.id WHERE n.state = 'delivered' AND m.attempts < 5 AND (m.first_attempt_at IS NULL OR m.first_attempt_at >= now() - interval '23 hours') AND ((m.state = 'pending' AND m.next_attempt_at <= now()) OR (m.state = 'processing' AND m.lease_until < now())) ORDER BY m.next_attempt_at, m.id LIMIT 5 FOR UPDATE OF m SKIP LOCKED) UPDATE mail_jobs m SET state = 'processing', attempts = attempts + 1, first_attempt_at = COALESCE(first_attempt_at, now()), lease_token = ${token}, lease_until = now() + interval '2 minutes' FROM candidates WHERE m.id = candidates.id RETURNING m.*`;
      for (const job of claimed) {
        await tx`UPDATE mail_attempts SET outcome = 'lease_expired', finished_at = now() WHERE job_id = ${job.id} AND outcome = 'processing'`;
        await tx`INSERT INTO mail_attempts (job_id, attempt, outcome) VALUES (${job.id}, ${job.attempts}, 'processing')`;
      }
      return claimed;
    });
    let accepted = 0;
    for (const job of jobs) {
      let outcome:
        | "accepted"
        | "provider_error"
        | "delivery_uncertain"
        | "recipient_ineligible" = "delivery_uncertain";
      try {
        const [recipient] =
          await sql`SELECT u.email, u."emailVerified", p.email_enabled FROM "user" u LEFT JOIN notification_preferences p ON p.user_id = u.id WHERE u.id = ${job.recipient_id}`;
        if (
          !recipient?.emailVerified ||
          !recipient.email_enabled ||
          recipient.email !== job.recipient_email
        ) {
          outcome = "recipient_ineligible";
        } else if (env.AUTH_EMAIL_MODE === "outbox") {
          await sql`INSERT INTO auth_mail_outbox (recipient, subject, url, body, delivery_key) VALUES (${job.recipient_email}, ${job.subject}, ${job.url}, ${job.body}, ${job.id}) ON CONFLICT (delivery_key) DO NOTHING`;
          outcome = "accepted";
        } else {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `notification-${job.id}`,
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM,
              to: [job.recipient_email],
              subject: job.subject,
              text: job.body,
              html: job.html,
            }),
            signal: AbortSignal.timeout(10000),
          });
          outcome = response.ok ? "accepted" : "provider_error";
        }
      } catch {
        /* Transport/storage errors do not prove that the provider rejected delivery. */
      }
      const state =
        outcome === "accepted"
          ? "accepted"
          : outcome === "recipient_ineligible"
            ? "cancelled"
            : job.attempts >= 5
              ? "failed"
              : "pending";
      const delaySeconds = Math.min(3600, 30 * 2 ** job.attempts);
      // If acknowledgement fails, the lease expires and the stable key protects a later retry.
      const saved = await sql.begin(async (tx) => {
        const rows =
          await tx`UPDATE mail_jobs SET state = ${state}, last_result = ${outcome}, next_attempt_at = now() + ${delaySeconds} * interval '1 second', lease_token = NULL, lease_until = NULL WHERE id = ${job.id} AND lease_token = ${token} RETURNING id`;
        if (!rows.length) return false;
        await tx`UPDATE mail_attempts SET outcome = ${outcome}, finished_at = now() WHERE job_id = ${job.id} AND attempt = ${job.attempts} AND outcome = 'processing'`;
        return true;
      });
      if (saved && outcome === "accepted") accepted++;
    }
    return accepted;
  } finally {
    await sql.end();
  }
}
