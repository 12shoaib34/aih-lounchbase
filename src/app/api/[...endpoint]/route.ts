import app from "../../../../product/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { AppEnv } from "../../../../product/server/access";

export const dynamic = "force-dynamic";
async function dispatch(request: Request) {
  let env: AppEnv["Bindings"] = process.env as AppEnv["Bindings"];
  let execution: Parameters<typeof app.fetch>[2];
  try {
    const runtime = await getCloudflareContext({ async: true });
    env = runtime.env as AppEnv["Bindings"];
    execution = runtime.ctx as typeof execution;
  } catch {
    /* Next development also supports process environment configuration. */
  }
  return app.fetch(request, env, execution);
}
export {
  dispatch as GET,
  dispatch as POST,
  dispatch as PUT,
  dispatch as PATCH,
  dispatch as DELETE,
};
