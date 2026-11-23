import {
  startQueueRun,
  finishQueueRun,
} from "../../server/queue-schedule-state";
import { randomUUID } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import postgres from "postgres";
import { unstable_dev } from "wrangler";
import { expect, it } from "vitest";

it("dispatches scheduled events through local Workers into PostgreSQL and the local outbox", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated PostgreSQL required");
  const sql = postgres(process.env.DATABASE_URL);
  const userId = randomUUID();
  const jobId = randomUUID();
  const email = `schedule-${userId}@example.com`;
  const directory = await mkdtemp(join(tmpdir(), "foundation-schedule-"));
  let worker: Awaited<ReturnType<typeof unstable_dev>> | undefined;
  try {
    await sql`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (${userId}, 'Schedule fixture', ${email}, true, now(), now())`;
    await sql`INSERT INTO notification_preferences (user_id, email_enabled) VALUES (${userId}, true)`;
    await sql`INSERT INTO notification_jobs (id, recipient_id, title, body, due_at) VALUES (${jobId}, ${userId}, 'Fixture', 'Fixture body', now() - interval '1 minute')`;
    await sql`INSERT INTO mail_jobs (id, recipient_id, recipient_email, subject, body, html, url, state) VALUES (${jobId}, ${userId}, ${email}, 'Fixture', 'Fixture body', '<p>Fixture</p>', 'http://localhost:8787', 'pending')`;
    const beforeState = await sql`SELECT * FROM queue_schedule_state`;
    for (const enabled of [false, true]) {
      const config = join(directory, `worker-${enabled}.json`);
      await writeFile(
        config,
        JSON.stringify({
          name: "combined-schedule-test",
          assets: { directory: resolve(".open-next/assets"), binding: "ASSETS" },
          main: resolve("worker.ts"),
          compatibility_date: "2026-11-01",
          compatibility_flags: ["nodejs_compat"],
          vars: {
            DATABASE_URL: process.env.DATABASE_URL,
            AUTH_SECRET: randomUUID() + randomUUID(),
            AUTH_BASE_URL: "http://localhost:8787",
            AUTH_EMAIL_MODE: "outbox",
            APP_ENV: "development",
            QUEUE_SCHEDULE_ENABLED: String(enabled),
            QUEUE_EMAIL_ENABLED: String(enabled),
          },
        }),
        { mode: 0o600 },
      );
      worker = await unstable_dev(resolve("worker.ts"), {
        config,
        envFiles: [],
        local: true,
        ip: "127.0.0.1",
        port: 0,
        logLevel: "none",
        inspect: false,
        persistTo: join(directory, "state"),
        experimental: {
          testScheduled: true,
          watch: false,
          disableDevRegistry: true,
          disableExperimentalWarning: true,
        },
      });
      for (let repeat = 0; repeat < 2; repeat++) {
        const response = await worker.fetch("/__scheduled?cron=*+*+*+*+*");
        expect(response.ok).toBe(true);
      }
      const [notification] =
        await sql`SELECT state FROM notification_jobs WHERE id = ${jobId}`;
      expect(notification.state).toBe(enabled ? "delivered" : "pending");
      expect(
        await sql`SELECT id FROM notifications WHERE id = ${jobId}`,
      ).toHaveLength(enabled ? 1 : 0);
      expect(
        await sql`SELECT id FROM auth_mail_outbox WHERE delivery_key = ${jobId}`,
      ).toHaveLength(enabled ? 1 : 0);
      if (enabled)
        expect(
          (
            await sql`SELECT status, email_enabled, last_success_at, last_email_success_at FROM queue_schedule_state`
          )[0],
        ).toMatchObject({
          status: "completed",
          email_enabled: true,
          last_success_at: expect.any(Date),
          last_email_success_at: expect.any(Date),
        });
      else
        expect(await sql`SELECT * FROM queue_schedule_state`).toEqual(
          beforeState,
        );
      await worker.stop();
      worker = undefined;
    }
    expect(
      (await sql`SELECT state, attempts FROM mail_jobs WHERE id = ${jobId}`)[0],
    ).toMatchObject({ state: "accepted", attempts: 1 });
    const older = await startQueueRun(
      { DATABASE_URL: process.env.DATABASE_URL },
      true,
    );
    const newer = await startQueueRun(
      { DATABASE_URL: process.env.DATABASE_URL },
      false,
    );
    await finishQueueRun(
      { DATABASE_URL: process.env.DATABASE_URL },
      older,
      false,
      true,
    );
    expect(
      (await sql`SELECT run_id, status FROM queue_schedule_state`)[0],
    ).toMatchObject({ run_id: newer, status: "running" });
    await finishQueueRun(
      { DATABASE_URL: process.env.DATABASE_URL },
      newer,
      true,
      false,
    );
  } finally {
    await worker?.stop();
    await sql`DELETE FROM "user" WHERE id = ${userId}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ${email}`;
    await sql.end();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
