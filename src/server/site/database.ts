import postgres from "postgres";
export async function withDatabase<T>(operation: (sql: postgres.Sql) => Promise<T>, url = process.env.DATABASE_URL) {
  if (!url) throw new Error("Database unavailable");
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5 });
  try { return await operation(sql); }
  finally { await sql.end({ timeout: 2 }); }
}
