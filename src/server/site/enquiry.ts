import { authConfiguration } from "../../../product/server/auth-configuration";
import { queueTrackingLink } from "./tracking-mail";
import { withDatabase } from "./database";
const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const limits = {
  company: 150, budget: 150, timeline: 150, name: 100, email: 254, service: 150, technology: 100, solution: 100, message: 5000,
  validation: 3000, founderPlan: 3000, companyStage: 100, mvpJourney: 2000, commitment: 2000,
} as const;
type Field = keyof typeof limits;

interface Siteverify { success?: unknown; hostname?: unknown; action?: unknown; "error-codes"?: unknown }

// Diagnostics: one JSON line per rejected/failed/accepted POST. Only reason codes, lengths and booleans are logged —
// never the email, name, message, IP, token or any secret value.
function reject(reason: string, status: number, body: unknown, extra: Record<string, unknown> = {}): Response {
  console.warn(JSON.stringify({ evt: "enquiry.reject", reason, status, ...extra }));
  return json(body, status);
}
const kind = (v: unknown): string => (v === null ? "null" : Array.isArray(v) ? "array" : typeof v);

export async function handleEnquiry(request: Request, env: Record<string,string | undefined> = process.env, verify = fetch): Promise<Response> {
  const enabled = !!(env.DATABASE_URL && env.PUBLIC_ORIGIN && env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY);
  if (request.method === "GET") return json({ enabled, siteKey: enabled ? env.TURNSTILE_SITE_KEY : null });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!enabled)
    return reject("disabled", 503, { error: "Sending is not configured. Please save your brief." },
      { db: !!env.DATABASE_URL, ts: !!env.TURNSTILE_SECRET, sk: !!env.TURNSTILE_SITE_KEY, po: !!env.PUBLIC_ORIGIN });
  const origin = request.headers.get("Origin");
  if (origin !== env.PUBLIC_ORIGIN) return reject("origin", 403, { error: "Origin not allowed" });
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) return reject("content_type", 415, { error: "JSON required" });
  const reader = request.body?.getReader();
  if (!reader) return reject("no_body", 400, { error: "Missing body" });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 24000) {
      await reader.cancel();
      return reject("too_large", 413, { error: "Request too large" }, { bytes: size });
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.length;
  }
  let data: unknown;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { return reject("bad_json", 400, { error: "Invalid request" }); }
  if (!data || typeof data !== "object" || Array.isArray(data)) return reject("not_object", 400, { error: "Invalid request" });
  const input = data as Record<string, unknown>;
  const clean = {} as Record<Field, string>;
  for (const [key, max] of Object.entries(limits) as [Field, number][]) {
    const v = input[key] ?? "";
    if (typeof v !== "string" || v.length > max)
      return reject("field", 400, { error: "Invalid field: " + key }, { field: key, type: kind(v), len: typeof v === "string" ? v.length : null, max });
    clean[key] = v.trim();
  }
  if (input.website)
    return reject("honeypot", 400, { error: "Submission rejected" }, { len: typeof input.website === "string" ? input.website.length : null });
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean.email) && !/[\r\n]/.test(clean.email);
  if (!clean.name || !emailOk || clean.message.length < 10 || !clean.service)
    return reject("invalid", 400, { error: "Please provide your name, valid email, service and project details." },
      { name: !!clean.name, emailOk, msgLen: clean.message.length, service: !!clean.service });
  if (clean.service.startsWith("Venture partnership")) {
    const missing = (["validation", "founderPlan", "companyStage", "mvpJourney", "commitment"] as const).filter((k) => !clean[k]);
    if (missing.length || input.equityAck !== "on")
      return reject("venture", 400, { error: "Complete the venture questions and equity acknowledgement." }, { missing, ack: input.equityAck === "on" });
  }
  if (typeof input.token !== "string" || input.token.length > 2048 || !input.token)
    return reject("token", 400, { error: "Complete the verification." },
      { type: kind(input.token), len: typeof input.token === "string" ? input.token.length : null });
  const token = input.token;
  try {
    const address = request.headers.get("CF-Connecting-IP");
    if (address) {
      const hour = Math.floor(Date.now() / 3600000);
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.TURNSTILE_SECRET + "|" + address + "|" + hour));
      const bucket = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
      const count = await withDatabase(async sql => {
        await sql`DELETE FROM site_submission_windows WHERE expires <= ${hour}`;
        const [row] = await sql`INSERT INTO site_submission_windows VALUES (${bucket},1,${hour+1})
          ON CONFLICT(bucket) DO UPDATE SET count=site_submission_windows.count+1 RETURNING count`;
        return row.count;
      }, env.DATABASE_URL);
      if (count > 20) return json({error:"Too many attempts. Try again next hour."}, 429);
    }
    const verification = await verify("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", body: new URLSearchParams({ secret: env.TURNSTILE_SECRET!, response: token }), signal: AbortSignal.timeout(10000),
    });
    const check = (await verification.json()) as Siteverify;
    const hostOk = check.hostname === new URL(env.PUBLIC_ORIGIN).hostname;
    if (!verification.ok || check.success !== true || !hostOk || check.action !== "enquiry")
      return reject("siteverify", 400, { error: "Verification expired or failed. Please try again." }, {
        http: verification.status, success: check.success === true, hostOk,
        action: typeof check.action === "string" ? check.action.slice(0, 40) : null,
        codes: Array.isArray(check["error-codes"]) ? check["error-codes"].filter((c) => typeof c === "string").slice(0, 5).map((c: string) => c.slice(0, 60)) : [],
      });
    const id = input.submissionId ?? crypto.randomUUID();
    if (typeof id !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id))
      return json({error:"Invalid enquiry reference."}, 400);
    const payload = {...clean, equityAck: input.equityAck === "on"};
    const same = await withDatabase(sql => sql.begin(async tx => {
      const inserted = await tx`INSERT INTO site_enquiries(id,payload) VALUES (${id},${tx.json(payload)}::jsonb)
        ON CONFLICT DO NOTHING RETURNING id`;
      if (inserted.length) {
        await tx`INSERT INTO site_notifications(enquiry_id) VALUES (${id})`;
        await queueTrackingLink(tx,id);
        return true;
      }
      const [existing] = await tx`SELECT payload = ${tx.json(payload)}::jsonb AS matches FROM site_enquiries WHERE id=${id}`;
      return existing.matches;
    }), env.DATABASE_URL);
    if (!same) return json({error:"This reference already belongs to a different enquiry."},409);
    let trackingEnabled = false;
    try { trackingEnabled = !!authConfiguration(env); } catch { /* Keep the accepted receipt available. */ }
    const instructions = trackingEnabled ? " Check your email for your private sign-in link." : "";
    return json({ok:true,reference:id,trackingEnabled,message:"Your enquiry has been received."+instructions+" Reference: " + id});
  } catch {
    return json({error:"Could not confirm receipt. Your details are preserved; please retry."},502);
  }
}
