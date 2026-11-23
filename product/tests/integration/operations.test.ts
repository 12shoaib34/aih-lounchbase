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
    const loseAcknowledgement = (script: string, ...args: string[]) =>
      exec(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--import",
          "./product/tests/integration/fixtures/lost-owner-commit.mjs",
          `scripts/${script}.mjs`,
          ...args,
        ],
        { env: { ...process.env, DATABASE_URL: url.toString() } },
      );
    const failedReference = async (command: ReturnType<typeof run>) => {
      const failure = await command.then(
        () => null,
        (error: { code: number; stdout: string; stderr: string }) => error,
      );
      expect(failure?.code).toBe(1);
      expect(failure?.stdout).toBe("");
      expect(failure?.stderr).toContain("could not be confirmed");
      expect(failure?.stderr).not.toMatch(
        /rollback|no transaction changes were committed/i,
      );
      const reference = failure?.stderr.match(
        /audit reference ([0-9a-f-]{36})/i,
      )?.[1];
      expect(reference).toBeDefined();
      return reference!;
    };
    await sql`CREATE FUNCTION reject_owner_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected commit rejection'; END $$`;
    const rejectCommit = () =>
      sql!`CREATE CONSTRAINT TRIGGER reject_owner_commit AFTER INSERT ON admin_audit_events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_owner_commit()`;
    const allowCommit = () =>
      sql!`DROP TRIGGER reject_owner_commit ON admin_audit_events`;
    await rejectCommit();
    const rejectedBootstrap = await failedReference(
      run("bootstrap-owner", "old@example.com"),
    );
    expect(
      await sql`SELECT user_id FROM team_members WHERE role='owner'`,
    ).toHaveLength(0);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE request_id=${rejectedBootstrap}`,
    ).toHaveLength(0);
    await allowCommit();
    const bootstrapRef = await failedReference(
      loseAcknowledgement("bootstrap-owner", "old@example.com"),
    );
    expect(
      await sql`SELECT action,target_id FROM admin_audit_events WHERE request_id=${bootstrapRef}`,
    ).toEqual([{ action: "owner.bootstrapped", target_id: "old" }]);
    expect((await run("bootstrap-owner", "old@example.com")).stdout).toContain(
      "already the owner",
    );

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
    expect(
      (await run("transfer-owner", "old@example.com", "next@example.com"))
        .stdout,
    ).toContain("Preview passed");
    await expect(
      run("transfer-owner", "old@example.com", " OLD@example.com ", "--apply"),
    ).rejects.toThrow();
    await rejectCommit();
    const rejectedTransfer = await failedReference(
      run("transfer-owner", "old@example.com", "next@example.com", "--apply"),
    );
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE request_id=${rejectedTransfer}`,
    ).toHaveLength(0);
    expect(await sql`SELECT id FROM session`).toEqual([{ id: "fresh" }]);
    await allowCommit();
    expect(
      (await sql`SELECT user_id FROM team_members WHERE role = 'owner'`)[0]
        .user_id,
    ).toBe("old");
    const transferred = await run(
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
      await sql`SELECT action, request_id FROM admin_audit_events WHERE action IN ('owner.transferred_out','owner.transferred_in') ORDER BY id`;
    expect(events.map((row) => row.action)).toEqual([
      "owner.transferred_out",
      "owner.transferred_in",
    ]);
    expect(events[0].request_id).toBe(events[1].request_id);
    expect(transferred.stdout).toContain("Ownership transferred");
    expect(transferred.stdout).toContain(events[0].request_id);
    await expect(
      run("transfer-owner", "old@example.com", "next@example.com", "--apply"),
    ).rejects.toThrow();
    await run("retention", "--apply");
    expect(await sql`SELECT id FROM admin_audit_events`).toHaveLength(3);
    const transferRef = await failedReference(
      loseAcknowledgement(
        "transfer-owner",
        "next@example.com",
        "old@example.com",
        "--apply",
      ),
    );
    expect(
      await sql`SELECT user_id FROM team_members WHERE role='owner'`,
    ).toEqual([{ user_id: "old" }]);
    expect(
      await sql`SELECT action,target_id FROM admin_audit_events WHERE request_id=${transferRef} ORDER BY id`,
    ).toEqual([
      { action: "owner.transferred_out", target_id: "next" },
      { action: "owner.transferred_in", target_id: "old" },
    ]);
  } finally {
    await sql?.end();
    if (created) await admin.unsafe(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}, 30000);
