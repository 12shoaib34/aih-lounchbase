// Disposable local fixture entry. The deployment entry is worker.ts.
import worker from "../worker";
// Emulate only the external challenge provider. Submit through the actual Next route.
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    const body = await new Request(input, init).text();
    const fields = new URLSearchParams(body);
    return Response.json({
      success:
        fields.get("secret") === "local-fixture" &&
        fields.get("response") === "fixture-challenge",
      hostname: "127.0.0.1",
      action: "enquiry",
    });
  }
  return nativeFetch(input, init);
};
export default {
  ...worker,
  async fetch(
    request: Request,
    env: Record<string, string>,
    ctx: { waitUntil(task: Promise<unknown>): void },
  ) {
    const url = new URL(request.url);
    if (
      url.hostname !== "127.0.0.1" ||
      env.AUTH_EMAIL_MODE !== "outbox" ||
      url.origin !== env.AUTH_BASE_URL ||
      new URL(env.DATABASE_URL).hostname !== "127.0.0.1"
    )
      return new Response("Local fixture only", { status: 403 });
    if (url.pathname === "/__fixture/verification.js")
      return new Response(
        'window.turnstile={render:(el,c)=>{el.textContent="Local test verification";c.callback("fixture-challenge");return 1},reset:()=>{},remove:()=>{}};',
        { headers: { "content-type": "text/javascript" } },
      );
    const response = await worker.fetch(request, env, ctx);
    if (response.headers.get("content-type")?.includes("text/html")) {
      // @ts-expect-error Cloudflare runtime global
      return new HTMLRewriter()
        .on("head", {
          element(head: {
            prepend(text: string, options: { html: boolean }): void;
          }) {
            head.prepend('<script src="/__fixture/verification.js"></script>', {
              html: true,
            });
          },
        })
        .transform(response);
    }
    return response;
  },
};
