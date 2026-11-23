import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import app from "../../server";
import {
  queueTrackingLink,
  deliverTrackingLinks,
} from "../../../src/server/site/tracking-mail";

it("retries tracking mail with a stable key and rejects expired links and sessions", async () => {
  const url = process.env.DATABASE_URL!;
  const sql = postgres(url);
  const id = randomUUID(),
    origin = "https://enquiry.example.invalid",
    email = "fixture@example.invalid";
  const env = {
    DATABASE_URL: url,
    AUTH_SECRET: randomUUID(),
    AUTH_BASE_URL: origin,
    AUTH_EMAIL_MODE: "resend",
    EMAIL_FROM: email,
    RESEND_API_KEY: "fixture",
  };
  const headers = { Origin: origin, "Content-Type": "application/json" };
  const signIn = (token: string) =>
    app.request(
      origin + "/api/tracking/signin",
      {
        method: "POST",
        headers,
        body: JSON.stringify({ reference: id, token }),
      },
      env,
    );
  try {
    await sql.begin(async (tx) => {
      await tx`INSERT INTO site_enquiries(id,payload) VALUES(${id},${tx.json({ email, service: "Project enquiry" })})`;
      await queueTrackingLink(tx, id);
    });
    const keys: string[] = [];
    let link = "";
    const sender =
      (status: number) => async (_input: unknown, init?: RequestInit) => {
        keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
        link = JSON.parse(init!.body as string)
          .text.split("\n")
          .at(-1);
        return new Response(null, { status });
      };
    await deliverTrackingLinks(env, sender(503), id);
    await sql`UPDATE site_tracking_access SET next_attempt=now() WHERE enquiry_id=${id}`;
    await deliverTrackingLinks(env, sender(202), id);
    await deliverTrackingLinks(env, sender(202), id);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(new URL(link).origin).toBe(origin);
    const token = new URL(link).hash.slice(1);
    expect(
      (
        await sql`SELECT pending_token FROM site_tracking_access WHERE enquiry_id=${id}`
      )[0].pending_token,
    ).toBeNull();
    await sql`UPDATE site_tracking_access SET issued_at=now()-interval '25 hours' WHERE enquiry_id=${id}`;
    expect((await signIn(token)).status).toBe(401);
    await sql`UPDATE site_tracking_access SET issued_at=now() WHERE enquiry_id=${id}`;
    const success = await signIn(token);
    expect(success.status).toBe(200);
    const cookie = success.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect((await signIn(token)).status).toBe(401);
    await sql`UPDATE site_tracking_access SET session_until=now()-interval '1 second' WHERE enquiry_id=${id}`;
    expect(
      (
        await app.request(
          origin + "/api/tracking",
          { headers: { Cookie: cookie.split(";")[0] } },
          env,
        )
      ).status,
    ).toBe(401);
  } finally {
    await sql`DELETE FROM site_enquiries WHERE id=${id}`;
    await sql.end();
  }
});

it("restores legacy JSON receipts without sending historical customers mail", async () => {
  const sql = postgres(process.env.DATABASE_URL!);
  const id = randomUUID();
  const payload = { email: "legacy@example.invalid", service: "Earlier brief" };
  try {
    await sql`INSERT INTO site_enquiries(id,payload) VALUES (${id},${sql.json(JSON.stringify(payload))})`;
    await sql.unsafe(await readFile("database/site/001-public.sql", "utf8"));
    expect(
      (await sql`SELECT payload,status FROM site_enquiries WHERE id=${id}`)[0],
    ).toEqual({ payload, status: "Received" });
    expect(
      await sql`SELECT enquiry_id FROM site_tracking_access WHERE enquiry_id=${id}`,
    ).toHaveLength(0);
  } finally {
    await sql`DELETE FROM site_enquiries WHERE id=${id}`;
    await sql.end();
  }
});
