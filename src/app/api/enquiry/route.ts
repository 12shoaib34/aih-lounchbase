import { getCloudflareContext } from "@opennextjs/cloudflare";
import { handleEnquiry } from "../../../server/site/enquiry";
import { deliverTrackingLinks } from "../../../server/site/tracking-mail";
export const dynamic = "force-dynamic";
async function dispatch(request: Request) {
  let runtime;
  try {
    runtime = await getCloudflareContext({ async: true });
  } catch {
    /* Plain Next dev uses process environment. */
  }
  const env = (runtime?.env ?? process.env) as Record<string, string>;
  const response = await handleEnquiry(request, env);
  if (request.method === "POST" && response.ok && runtime) {
    const { reference } = (await response.clone().json()) as {
      reference: string;
    };
    runtime.ctx.waitUntil(
      deliverTrackingLinks(env, fetch, reference).catch(() =>
        console.warn("Tracking email queued for retry."),
      ),
    );
  }
  return response;
}
export { dispatch as GET, dispatch as POST };
