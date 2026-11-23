import type postgres from "postgres";
import {
  authConfiguration,
  type AuthBindings,
} from "../../../product/server/auth-configuration";
import { withDatabase } from "./database";

export const newSecret = () => crypto.randomUUID() + crypto.randomUUID();
export async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function queueTrackingLink(
  tx: postgres.TransactionSql,
  id: string,
) {
  const token = newSecret();
  const inserted =
    await tx`INSERT INTO site_tracking_access(enquiry_id,token_hash,pending_token)
    VALUES (${id},${await digest(token)},${token})
    ON CONFLICT(enquiry_id) DO UPDATE SET token_hash=excluded.token_hash,
      pending_token=excluded.pending_token, issued_at=now(), next_attempt=now(), used_at=NULL,
      links_issued=CASE WHEN site_tracking_access.window_started<=now()-interval '1 day' THEN 1 ELSE site_tracking_access.links_issued+1 END,
      window_started=CASE WHEN site_tracking_access.window_started<=now()-interval '1 day' THEN now() ELSE site_tracking_access.window_started END
    WHERE site_tracking_access.issued_at <= now()-interval '5 minutes'
      AND (site_tracking_access.window_started<=now()-interval '1 day' OR site_tracking_access.links_issued<3) RETURNING enquiry_id`;
  return inserted.length > 0;
}

export async function deliverTrackingLinks(
  env: AuthBindings,
  send = fetch,
  onlyId?: string,
) {
  const config = authConfiguration(env);
  if (!config) return;
  await withDatabase(async (sql) => {
    if (!onlyId)
      await sql`UPDATE site_tracking_access SET pending_token=NULL WHERE pending_token IS NOT NULL AND issued_at<=now()-interval '1 day'`;
    for (let i = 0; i < 10; i++) {
      const [job] =
        await sql`UPDATE site_tracking_access SET next_attempt=now()+interval '5 minutes'
        WHERE enquiry_id=(SELECT enquiry_id FROM site_tracking_access
          WHERE (${onlyId ?? null}::uuid IS NULL OR enquiry_id=${onlyId ?? null}::uuid) AND pending_token IS NOT NULL AND next_attempt<=now() AND issued_at>now()-interval '1 day'
          ORDER BY next_attempt LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING enquiry_id, pending_token, token_hash`;
      if (!job) break;
      const [row] =
        await sql`SELECT payload->>'email' AS email FROM site_enquiries WHERE id=${job.enquiry_id}`;
      const url = new URL("/app/account/enquiries", config.origin);
      url.searchParams.set("reference", job.enquiry_id);
      url.hash = job.pending_token;
      const subject = "Sign in to track your enquiry";
      const body =
        "Your enquiry reference is " +
        job.enquiry_id +
        ". Open your private link and select Sign in to see its status. The link expires in 24 hours.\n\n" +
        url.href;
      if (env.AUTH_EMAIL_MODE === "outbox") {
        await sql`INSERT INTO auth_mail_outbox(recipient,subject,url,body,delivery_key)
          VALUES (${row.email},${subject},${url.href},${body},${"tracking-" + job.token_hash})
          ON CONFLICT DO NOTHING`;
      } else {
        const response = await send("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + env.RESEND_API_KEY,
            "Content-Type": "application/json",
            "Idempotency-Key": "tracking-" + job.token_hash,
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM,
            to: [row.email],
            subject,
            text: body,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) continue;
      }
      await sql`UPDATE site_tracking_access SET pending_token=NULL WHERE enquiry_id=${job.enquiry_id} AND token_hash=${job.token_hash}`;
    }
  }, config.connectionString);
}
