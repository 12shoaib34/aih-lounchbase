// All destructive restore checks operate on directories created by this invocation.
import EmbeddedPostgres from "embedded-postgres";
import { randomUUID } from "node:crypto";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "aih-rehearsal-"));
const options = {
  user: "postgres",
  password: "fixture",
  persistent: true,
  onLog() {},
};
const primary = new EmbeddedPostgres({
  ...options,
  port: 54443,
  databaseDir: join(dir, "primary"),
});
const restored = new EmbeddedPostgres({
  ...options,
  port: 54444,
  databaseDir: join(dir, "restore"),
});
const env = {
  ...process.env,
  DATABASE_URL: "postgres://postgres:fixture@127.0.0.1:54443/rehearsal",
};
function run(args) {
  if (spawnSync(process.execPath, args, { stdio: "inherit", env }).status !== 0)
    throw new Error("Rehearsal failed in " + args[0]);
}
const marker = randomUUID();
async function snapshot(cluster, seed = false) {
  const client = cluster.getPgClient("rehearsal");
  await client.connect();
  try {
    if (seed) {
      await client.query(
        'INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ($1,$2,$3,false,now(),now())',
        [marker, "Restore fixture", marker + "@example.com"],
      );
      await client.query(
        "INSERT INTO site_enquiries (id,payload) VALUES ($1,$2)",
        [marker, { fixture: marker }],
      );
      await client.query(
        "INSERT INTO site_notifications (enquiry_id) VALUES ($1)",
        [marker],
      );
    }
    const { rows } = await client.query(
      'SELECT u.id, e.payload, n.attempts, (SELECT count(*) FROM schema_migrations) AS migrations FROM "user" u JOIN site_enquiries e ON e.id::text=u.id JOIN site_notifications n ON n.enquiry_id=e.id WHERE u.id=$1',
      [marker],
    );
    if (rows.length !== 1) throw Error("Restore marker missing");
    return JSON.stringify(rows);
  } finally {
    await client.end();
  }
}
try {
  await primary.initialise();
  await primary.start();
  await primary.createDatabase("rehearsal");
  run(["scripts/migrate.mjs"]);
  run(["scripts/migrate-site.mjs"]);
  run(["node_modules/vitest/vitest.mjs", "run"]);
  const expected = await snapshot(primary, true);
  await primary.stop();
  await cp(join(dir, "primary"), join(dir, "restore"), {
    recursive: true,
    verbatimSymlinks: true,
  });
  await restored.start();
  if ((await snapshot(restored)) !== expected)
    throw Error("Restored data differs");
  console.log(
    "PASS: stopped-cluster backup restored on independent PostgreSQL port",
  );
} finally {
  await restored.stop();
  await primary.stop();
  await rm(dir, { recursive: true, force: true });
}
