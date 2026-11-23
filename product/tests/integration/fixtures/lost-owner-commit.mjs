// Test-only preload: PostgreSQL commits normally, then the caller loses the result.
import postgres from "postgres";
import { mock } from "node:test";

mock.module("postgres", {
  defaultExport(...args) {
    const sql = postgres(...args);
    const begin = sql.begin;
    sql.begin = async (transaction) => {
      await begin(transaction);
      throw new Error("Simulated lost commit acknowledgement");
    };
    return sql;
  },
});
