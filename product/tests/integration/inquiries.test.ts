import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";
import app from "../../server/index";

it("validates public submissions, ignores honeypots and preserves exact retries at the hourly limit", async () => {
  const base = "http://localhost:8787";
  const env = {
    DATABASE_URL: process.env.DATABASE_URL!,
    AUTH_SECRET: randomUUID(),
    AUTH_BASE_URL: base,
    AUTH_EMAIL_MODE: "outbox",
  };
  const sql = postgres(env.DATABASE_URL);
  const email = randomUUID() + "@example.com";
  const payload = {
    id: randomUUID(),
    name: "Intake tester",
    email,
    answers: { request: "Call me" },
  };
  const send = (body: object, origin = base) =>
    app.request(
      base + "/api/inquiries",
      {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      env,
    );
  try {
    expect((await app.request(base + "/api/inquiries", {}, env)).status).toBe(
      401,
    );
    expect((await send(payload, "https://example.com")).status).toBe(403);
    expect((await send({ ...payload, answers: {} })).status).toBe(400);
    expect((await send({ ...payload, website: "spam" })).status).toBe(200);
    expect(
      await sql`SELECT id FROM customer_inquiries WHERE email=${email}`,
    ).toHaveLength(0);
    expect(
      (await Promise.all([send(payload), send(payload)])).map((r) => r.status),
    ).toEqual([200, 200]);
    expect((await send({ ...payload, name: "Replacement" })).status).toBe(409);
    for (let i = 0; i < 4; i++)
      expect((await send({ ...payload, id: randomUUID() })).status).toBe(200);
    expect((await send({ ...payload, id: randomUUID() })).status).toBe(429);
    expect((await send(payload)).status).toBe(200);
    expect(
      await sql`SELECT id FROM customer_inquiries WHERE email=${email}`,
    ).toHaveLength(5);
  } finally {
    await sql`DELETE FROM customer_inquiries WHERE email=${email}`;
    await sql.end();
  }
});
