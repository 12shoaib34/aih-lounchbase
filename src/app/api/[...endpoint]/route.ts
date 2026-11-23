import app from "../../../../product/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "../../../../product/server/access";

export const dynamic = "force-dynamic";
async function dispatch(request: Request) {
  let env: AppEnv["Bindings"] = process.env as AppEnv["Bindings"];
  try {
    env = (await getCloudflareContext({ async: true }))
      .env as AppEnv["Bindings"];
  } catch {
    /* Next development also supports process environment configuration. */
  }
  return app.fetch(request, env);
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as PATCH,
  dispatch as DELETE,
};
