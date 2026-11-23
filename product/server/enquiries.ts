import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { authenticate, ApiFault, type AppEnv } from "./access";
import { authConfiguration } from "./auth-configuration";
import { enquiryStatus } from "../shared/enquiries";
import { withDatabase } from "../../src/server/site/database";
import {
  deliverTrackingLinks,
  digest,
  newSecret,
  queueTrackingLink,
} from "../../src/server/site/tracking-mail";

export const enquiryAdmin = new Hono<AppEnv>();
enquiryAdmin.use("*", authenticate, async (c, next) => {
  if (c.get("teamRole") !== "owner")
    throw new ApiFault(403, "FORBIDDEN", "Administrator access is required.");
  await next();
});
enquiryAdmin.get("/", async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(1000000)
    .safeParse(c.req.query("page") ?? 1);
  if (!page.success) throw new ApiFault(400, "INVALID_PAGE", "Invalid page.");
  const rows = await c.get(
    "database",
  )`SELECT id,status,version,payload,received_at::text AS received,payload->>'service' AS service
    FROM site_enquiries ORDER BY received_at DESC,id DESC LIMIT 21 OFFSET ${(page.data - 1) * 20}`;
  return c.json({ items: rows.slice(0, 20), more: rows.length > 20 });
});
enquiryAdmin.patch("/:id", bodyLimit({ maxSize: 1024 }), async (c) => {
  const id = z.uuid().safeParse(c.req.param("id"));
  const input = z
    .object({ status: enquiryStatus, version: z.number().int().positive() })
    .safeParse(await c.req.json().catch(() => null));
  if (!id.success || !input.success)
    throw new ApiFault(400, "INVALID_STATUS", "Choose a valid status.");
  const rows = await c.get(
    "database",
  )`UPDATE site_enquiries SET status=${input.data.status},version=version+1
    WHERE id=${id.data} AND version=${input.data.version} RETURNING status,version`;
  if (!rows.length)
    throw new ApiFault(
      409,
      "CONFLICT",
      "This enquiry changed. Refresh and try again.",
    );
  return c.json(rows[0]);
});

export const tracking = new Hono<AppEnv>();
const cookie = "enquiry_session",
  path = "/api/tracking";
tracking.use("*", bodyLimit({ maxSize: 2048 }), async (c, next) => {
  const config = authConfiguration(c.env);
  if (!config)
    throw new ApiFault(503, "UNAVAILABLE", "Status tracking is unavailable.");
  if (c.req.method !== "GET" && c.req.header("Origin") !== config.origin)
    throw new ApiFault(403, "FORBIDDEN", "Invalid request origin.");
  await next();
});
const dbUrl = (env: AppEnv["Bindings"]) =>
  env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
tracking.post("/request", async (c) => {
  const input = z
    .object({ reference: z.uuid(), email: z.email().max(254) })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    throw new ApiFault(
      400,
      "INVALID_REQUEST",
      "Enter your full enquiry reference and email address.",
    );
  const queued = await withDatabase(
    (sql) =>
      sql.begin(async (tx) => {
        const [row] =
          await tx`SELECT id FROM site_enquiries WHERE id=${input.data.reference} AND lower(payload->>'email')=lower(${input.data.email})`;
        return row ? await queueTrackingLink(tx, row.id) : false;
      }),
    dbUrl(c.env),
  );
  if (queued) {
    // The durable queue is also consumed by cron or when running without a Worker context.
    let context;
    try {
      context = c.executionCtx;
    } catch {
      /* Plain Next development. */
    }
    context?.waitUntil(
      deliverTrackingLinks(c.env, fetch, input.data.reference).catch(() =>
        console.warn("Tracking email queued for retry."),
      ),
    );
  }
  return c.json({ ok: true }, 202);
});
tracking.post("/signin", async (c) => {
  const input = z
    .object({ reference: z.uuid(), token: z.string().length(72) })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    throw new ApiFault(400, "INVALID_LINK", "Request a new sign-in link.");
  const session = newSecret();
  const rows = await withDatabase(
    async (sql) => sql`UPDATE site_tracking_access
    SET used_at=now(),pending_token=NULL,session_hash=${await digest(session)},session_until=now()+interval '7 days'
    WHERE enquiry_id=${input.data.reference} AND token_hash=${await digest(input.data.token)}
    AND used_at IS NULL AND issued_at>now()-interval '1 day' RETURNING enquiry_id`,
    dbUrl(c.env),
  );
  if (!rows.length)
    throw new ApiFault(
      401,
      "INVALID_LINK",
      "This link has expired or has already been used. Request a new link.",
    );
  setCookie(c, cookie, session, {
    httpOnly: true,
    secure: new URL(c.env.AUTH_BASE_URL!).protocol === "https:",
    sameSite: "Strict",
    path,
    maxAge: 7 * 86400,
  });
  return c.json({ ok: true });
});
tracking.get("/", async (c) => {
  const session = getCookie(c, cookie);
  if (session?.length === 72) {
    const [row] = await withDatabase(
      async (
        sql,
      ) => sql`SELECT e.id,e.status,e.received_at::text AS received,e.payload->>'service' AS service
      FROM site_tracking_access a JOIN site_enquiries e ON e.id=a.enquiry_id
      WHERE a.session_hash=${await digest(session)} AND a.session_until>now()`,
      dbUrl(c.env),
    );
    if (row) return c.json(row);
  }
  throw new ApiFault(
    401,
    "UNAUTHORIZED",
    "Sign in using your private email link.",
  );
});
tracking.post("/signout", async (c) => {
  const session = getCookie(c, cookie);
  if (session?.length === 72)
    await withDatabase(
      async (sql) =>
        sql`UPDATE site_tracking_access SET session_hash=NULL,session_until=NULL WHERE session_hash=${await digest(session)}`,
      dbUrl(c.env),
    );
  setCookie(c, cookie, "", {
    path,
    maxAge: 0,
    httpOnly: true,
    sameSite: "Strict",
    secure: new URL(c.env.AUTH_BASE_URL!).protocol === "https:",
  });
  return c.json({ ok: true });
});
