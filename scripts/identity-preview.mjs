// Disposable local auth environment with a private test mailbox and database.
import EmbeddedPostgres from "embedded-postgres";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const directory = await mkdtemp(join(tmpdir(), "aih-identity-"));
const db = new EmbeddedPostgres({
  databaseDir: join(directory, "db"),
  user: "postgres",
  password: "postgres",
  port: 54441,
  persistent: false,
  onLog: () => {},
});
const DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:54441/identity_fixture";
let worker;
try {
  await db.initialise();
  await db.start();
  await db.createDatabase("identity_fixture");
  for (const script of ["scripts/migrate.mjs", "scripts/migrate-site.mjs"]) {
    const migration = spawn(process.execPath, [script], {
      env: { ...process.env, DATABASE_URL },
      stdio: "inherit",
    });
    if ((await once(migration, "exit"))[0] !== 0)
      throw Error("Fixture schema migration failed in " + script);
  }
  const settings = {
    DATABASE_URL,
    AUTH_SECRET: randomBytes(48).toString("hex"),
    AUTH_BASE_URL: "http://127.0.0.1:8841",
    AUTH_EMAIL_MODE: "outbox",
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_ADMIN_MFA_REQUIRED: "true",
    TEAM_INVITES_ENABLED: "true",
  };
  const vars = join(directory, "local.env");
  await writeFile(
    vars,
    Object.entries(settings)
      .map(([k, v]) => k + "=" + v)
      .join("\n"),
    { mode: 0o600 },
  );
  worker = spawn(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "dev",
      "--local",
      "--port",
      "8841",
      "--env-file",
      vars,
      "--log-level",
      "error",
    ],
    { stdio: "inherit" },
  );
  process.once("SIGTERM", () => worker.kill());
  process.once("SIGINT", () => worker.kill());
  console.log(
    "Disposable identity preview at http://127.0.0.1:8841/app/account",
  );
  process.exitCode = (await once(worker, "exit"))[0] ?? 0;
} finally {
  await db.stop();
  await rm(directory, { recursive: true, force: true });
}
