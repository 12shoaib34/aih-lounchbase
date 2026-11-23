import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(72184623)`;
    await tx`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`;
    const directory = new URL("../database/migrations/", import.meta.url);
    for (const name of (await readdir(directory))
      .filter((file) => file.endsWith(".sql"))
      .sort()) {
      const source = await readFile(new URL(name, directory), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const [existing] =
        await tx`SELECT checksum FROM schema_migrations WHERE name = ${name}`;
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await tx.unsafe(source);
      await tx`INSERT INTO schema_migrations (name, checksum) VALUES (${name}, ${checksum})`;
      console.log(`Applied ${name}`);
    }
  });
} finally {
  await sql.end();
}
