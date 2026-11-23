import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";

it("previews retention and ownership transfer, applies bounded cleanup and revokes transfer sessions", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated test PostgreSQL required.");
  const exec = promisify(execFile);
  const admin = postgres(process.env.DATABASE_URL, { max: 1 });
  const name = `foundation_ops_${randomUUID().replaceAll("-", "")}`;
  let created = false;
  let sql: ReturnType<typeof postgres> | undefined;
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
    created = true;
    const url = new URL(process.env.DATABASE_URL);
    url.pathname = `/${name}`;
    const run = (script: string, ...args: string[]) =>
      exec(process.execPath, [`scripts/${script}.mjs`, ...args], {
        env: { ...process.env, DATABASE_URL: url.toString() },
      });
    await run("migrate");
    sql = postgres(url.toString(), { max: 1 });
    for (const id of ["old", "next"])
      await sql`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (${id}, ${id}, ${`${id}@example.com`}, true, now(), now())`;
    expect((await run("bootstrap-owner", "old@example.com")).stdout).toContain("appointed");
    await sql`INSERT INTO session (id, token, "userId", "expiresAt", "updatedAt") VALUES ('expired', 'expired-test-session', 'old', now() - interval '10 days', now()), ('fresh', 'fresh-test-session', 'next', now() + interval '1 day', now())`;
    await sql`INSERT INTO auth_mail_outbox (recipient, subject, url, created_at) VALUES ('old@example.com', 'old', 'http://localhost/private', now() - interval '10 days')`;
    const failedJob = randomUUID();
    const finishedJob = randomUUID();
    for (const id of [failedJob, finishedJob]) {
      await sql`INSERT INTO notification_jobs (id, recipient_id, title, body, due_at, state, created_at) VALUES (${id}, 'old', 'Retention fixture', 'Body', now() - interval '100 days', 'delivered', now() - interval '100 days')`;
      await sql`INSERT INTO notifications (id, recipient_id, title, body, read_at) VALUES (${id}, 'old', 'Retention fixture', 'Body', now() - interval '100 days')`;
    }
    await sql`INSERT INTO mail_jobs (id, recipient_id, recipient_email, subject, body, html, url, state) VALUES (${failedJob}, 'old', 'old@example.com', 'Fixture', 'Body', 'Body', 'http://localhost', 'failed')`;
    const preview = JSON.parse((await run("retention")).stdout);
    expect(preview.mode).toBe("preview");
    expect(preview.counts.expiredSessions).toBe(1);
    expect(preview.counts.finishedNotifications).toBe(1);
    expect(await sql`SELECT id FROM session`).toHaveLength(2);
    await run("retention", "--apply");
    expect((await sql`SELECT id FROM session`).map((row) => row.id)).toEqual([
      "fresh",
    ]);
    expect(await sql`SELECT id FROM auth_mail_outbox`).toHaveLength(0);
    expect(
      (await sql`SELECT id FROM notification_jobs`).map((row) => row.id),
    ).toEqual([failedJob]);
    expect(
      await sql`SELECT id FROM mail_jobs WHERE id = ${failedJob}`,
    ).toHaveLength(1);
    await run("transfer-owner", "old@example.com", "next@example.com");
    expect(
      (await sql`SELECT user_id FROM team_members WHERE role = 'owner'`)[0]
        .user_id,
    ).toBe("old");
    await run(
      "transfer-owner",
      "old@example.com",
      "next@example.com",
      "--apply",
    );
    expect(
      (await sql`SELECT user_id FROM team_members WHERE role = 'owner'`)[0]
        .user_id,
    ).toBe("next");
    expect(
      await sql`SELECT user_id FROM team_members WHERE user_id = 'old'`,
    ).toHaveLength(0);
    expect(await sql`SELECT id FROM session`).toHaveLength(0);
    const events =
      await sql`SELECT action, request_id FROM admin_audit_events ORDER BY id`;
    expect(events.map((row) => row.action)).toEqual([
      "owner.bootstrapped",
      "owner.transferred_out",
      "owner.transferred_in",
    ]);
    expect(events[1].request_id).toBe(events[2].request_id);
    await expect(
      run("transfer-owner", "old@example.com", "next@example.com", "--apply"),
    ).rejects.toThrow();
    await run("retention", "--apply");
    expect(await sql`SELECT id FROM admin_audit_events`).toHaveLength(3);
  } finally {
    await sql?.end();
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}, 30000);
