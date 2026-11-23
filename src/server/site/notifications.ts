import { withDatabase } from "./database";

// Resend keeps idempotency keys for 24 hours. Leave ambiguous older rows for operator review.
export async function deliverNotifications(env: Record<string,string>, send = fetch) {
  if (!env.DATABASE_URL || !env.RESEND_API_KEY || !env.ENQUIRY_TO || !env.ENQUIRY_FROM) return;
  await withDatabase(async sql => {
    for (let i=0; i<10; i++) {
      const [job] = await sql`UPDATE site_notifications SET next_attempt=now()+interval '5 minutes',
        attempts=attempts+1, first_attempt=coalesce(first_attempt,now())
        WHERE enquiry_id=(SELECT enquiry_id FROM site_notifications
          WHERE delivered_at IS NULL AND next_attempt<=now() AND
          (first_attempt IS NULL OR first_attempt>now()-interval '23 hours')
          ORDER BY next_attempt LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING enquiry_id`;
      if (!job) break;
      const id = job.enquiry_id;
      const [row] = await sql`SELECT payload FROM site_enquiries WHERE id=${id}`;
      const response = await send("https://api.resend.com/emails", {
        method:"POST", headers:{Authorization:"Bearer "+env.RESEND_API_KEY,"Content-Type":"application/json","Idempotency-Key":"site-enquiry-"+id},
        body: JSON.stringify({from:env.ENQUIRY_FROM,to:[env.ENQUIRY_TO],subject:"Website enquiry "+id,
          text:Object.entries(row.payload).filter(([,value])=>value).map(([key,value])=>key+": "+value).join("\n")}),
        signal:AbortSignal.timeout(12000)
      });
      if (response.ok) await sql`UPDATE site_notifications SET delivered_at=now() WHERE enquiry_id=${id}`;
    }
  },env.DATABASE_URL);
}
