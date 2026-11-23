import postgres from "postgres";
import { readFile } from "node:fs/promises";
if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for the target website database");
const sql = postgres(process.env.DATABASE_URL, {max:1});
try {
  const migration = await readFile(new URL("../database/site/001-public.sql",import.meta.url),"utf8");
  await sql.begin(tx => tx.unsafe(migration));
} finally { await sql.end(); }
