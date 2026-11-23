import { deliverTrackingLinks } from "./src/server/site/tracking-mail";
// @ts-ignore OpenNext generates this module during the application build.
import app from "./.open-next/worker.js";
import { deliverNotifications } from "./src/server/site/notifications";
import { runQueueSchedule } from "./product/server/queue-schedule";

export default {
  ...app,
  async scheduled(_event: unknown, env: Record<string, string>) {
    const results = await Promise.allSettled([
      deliverNotifications(env),
      runQueueSchedule(env),
      deliverTrackingLinks(env),
    ]);
    if (results.some((result) => result.status === "rejected"))
      throw new Error("Scheduled delivery did not complete.");
  },
};
