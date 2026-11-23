import { connectDatabase, type DatabaseBindings } from "./database";

export async function startQueueRun(
  env: DatabaseBindings,
  emailEnabled: boolean,
) {
  const sql = connectDatabase(env);
  const runId = crypto.randomUUID();
  try {
    await sql`INSERT INTO queue_schedule_state (name, run_id, started_at, status, email_enabled) VALUES ('notifications', ${runId}, clock_timestamp(), 'running', ${emailEnabled}) ON CONFLICT (name) DO UPDATE SET run_id = EXCLUDED.run_id, started_at = EXCLUDED.started_at, finished_at = NULL, status = 'running', email_enabled = EXCLUDED.email_enabled`;
    return runId;
  } finally {
    await sql.end();
  }
}

export async function finishQueueRun(
  env: DatabaseBindings,
  runId: string,
  succeeded: boolean,
  emailEnabled: boolean,
) {
  const sql = connectDatabase(env);
  try {
    // A late older invocation must not overwrite a newer invocation's state.
    await sql`UPDATE queue_schedule_state SET status = ${succeeded ? "completed" : "failed"}, finished_at = clock_timestamp(), last_success_at = CASE WHEN ${succeeded} THEN clock_timestamp() ELSE last_success_at END, last_email_success_at = CASE WHEN ${succeeded && emailEnabled} THEN clock_timestamp() ELSE last_email_success_at END WHERE name = 'notifications' AND run_id = ${runId}`;
  } finally {
    await sql.end();
  }
}
