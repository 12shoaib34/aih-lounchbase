import { startQueueRun, finishQueueRun } from "./queue-schedule-state";
import { authConfiguration, type AuthBindings } from "./auth-configuration";
import { deliverNotifications } from "./notifications";
import { deliverMailJobs } from "./mail-jobs";

export type QueueScheduleBindings = AuthBindings & {
  QUEUE_SCHEDULE_ENABLED?: string;
  QUEUE_EMAIL_ENABLED?: string;
};

// No row contents, credentials, provider errors or recipient identifiers in logs.
export async function runQueueSchedule(env: QueueScheduleBindings) {
  const report: {
    event: string;
    status: "disabled" | "completed" | "failed";
    notifications: { status: string; delivered?: number };
    email: { status: string; accepted?: number };
  } = {
    event: "queue.schedule",
    status: "disabled",
    notifications: { status: "skipped" },
    email: { status: "skipped" },
  };
  try {
    for (const value of [env.QUEUE_SCHEDULE_ENABLED, env.QUEUE_EMAIL_ENABLED])
      if (value !== undefined && value !== "true" && value !== "false")
        throw new Error("Invalid queue flag");
    if (
      env.QUEUE_EMAIL_ENABLED === "true" &&
      env.QUEUE_SCHEDULE_ENABLED !== "true"
    )
      throw new Error("Email schedule requires queue schedule");
    if (env.QUEUE_SCHEDULE_ENABLED !== "true") {
      console.log(JSON.stringify(report));
      return;
    }
    if (!authConfiguration(env)) throw new Error("Accounts required");
  } catch {
    report.status = "failed";
    console.error(JSON.stringify({ ...report, reason: "configuration" }));
    throw new Error("Scheduled queue configuration is invalid.");
  }
  let runId: string;
  try {
    runId = await startQueueRun(env, env.QUEUE_EMAIL_ENABLED === "true");
  } catch {
    console.error(
      JSON.stringify({ ...report, status: "failed", reason: "state-start" }),
    );
    throw new Error(
      "Scheduled queue state could not be recorded; processing was not started.",
    );
  }
  report.status = "completed";
  try {
    report.notifications = {
      status: "completed",
      delivered: await deliverNotifications(env),
    };
  } catch {
    report.status = "failed";
    report.notifications = { status: "failed" };
  }
  // Existing delivered notifications may still have due mail if inbox delivery fails.
  if (env.QUEUE_EMAIL_ENABLED === "true") {
    try {
      report.email = {
        status: "completed",
        accepted: await deliverMailJobs(env),
      };
    } catch {
      report.status = "failed";
      report.email = { status: "failed" };
    }
  }
  try {
    await finishQueueRun(
      env,
      runId,
      report.status === "completed",
      env.QUEUE_EMAIL_ENABLED === "true",
    );
  } catch {
    console.error(
      JSON.stringify({ ...report, status: "failed", reason: "state-finish" }),
    );
    throw new Error(
      "Scheduled queue completion could not be recorded; inspect queue status before retrying.",
    );
  }
  if (report.status === "failed") {
    console.error(JSON.stringify(report));
    throw new Error("Scheduled queue processing failed; inspect queue status.");
  }
  console.log(JSON.stringify(report));
}
