// @ts-ignore OpenNext generates this module during the application build.
import app from "./.open-next/worker.js";
import { deliverNotifications } from "./src/server/site/notifications";
export default { ...app, async scheduled(_event: unknown, env: Record<string,string>) {
  await deliverNotifications(env);
} };
