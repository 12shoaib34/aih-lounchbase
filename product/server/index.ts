import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { authConfiguration, createAuth } from "./auth";
import { connectDatabase } from "./database";
import { profileInput } from "../shared/profile";
import { authenticate, ApiFault, type AppEnv } from "./access";
import { team } from "./team";
import { audit } from "./audit";
import { business } from "./business";
import { admin } from "./admin";
import { records } from "./records";
const app = new Hono<AppEnv>();
app.use("*", async (c, next) => {
  const supplied = c.req.header("X-Request-ID");
  c.header(
    "X-Request-ID",
    supplied &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        supplied,
      )
      ? supplied
      : crypto.randomUUID(),
  );
  c.set("requestId", c.res.headers.get("X-Request-ID")!);
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});
app.get("/api/health", (c) => c.json({ status: "ok" }));
app.get("/api/capabilities", (c) =>
  c.json({
    accounts: !!authConfiguration(c.env),
    signup: c.env.AUTH_ALLOW_SIGNUP === "true",
  }),
);
app.use("/api/auth/*", bodyLimit({ maxSize: 16384 }));
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const service = createAuth(c.env);
  if (!service)
    return c.json(
      {
        error: {
          code: "UNAVAILABLE",
          message: "Account access is not configured.",
        },
      },
      503,
    );
  try {
    return await service.auth.handler(c.req.raw);
  } finally {
    await service.close();
  }
});
app.get("/api/access", authenticate, (c) =>
  c.json({
    mfaRequired: c.get("mfaRequired"),
    userId: c.get("userId"),
    teamRole: c.get("teamRole"),
    permissions: c.get("permissions"),
  }),
);
app.route("/api/admin", admin);
app.route("/api/team", team);
app.route("/api/business", business);
app.route("/api/audit", audit);
app.route("/api/records", records);
app.use("/api/profile", authenticate);
app.get("/api/profile", async (c) => {
  const {
    rows: [profile],
  } = await c
    .get("databasePool")
    .query("SELECT display_name FROM profiles WHERE user_id = $1", [
      c.get("userId"),
    ]);
  return c.json({ displayName: profile?.display_name ?? "" });
});
app.use(
  "/api/profile",
  bodyLimit({
    maxSize: 4096,
    onError: (c) =>
      c.json(
        {
          error: {
            code: "PAYLOAD_TOO_LARGE",
            message: "Request is too large.",
          },
        },
        413,
      ),
  }),
);
app.put("/api/profile", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = profileInput.safeParse(body);
  if (!parsed.success)
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter a name between 1 and 100 characters.",
        },
      },
      400,
    );
  const sql = connectDatabase(c.env);
  try {
    await sql`INSERT INTO profiles (user_id, display_name) VALUES (${c.get("userId")}, ${parsed.data.displayName}) ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`;
    return c.json({ displayName: parsed.data.displayName });
  } finally {
    await sql.end();
  }
});
app.notFound((c) =>
  c.json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } }, 404),
);
app.onError((_error, c) => {
  if (_error instanceof ApiFault)
    return c.json(
      {
        error: {
          code: _error.code,
          message: _error.message,
          ...(_error.fields ? { fields: _error.fields } : {}),
        },
      },
      _error.status,
    );
  console.error(
    JSON.stringify({
      requestId: c.res.headers.get("X-Request-ID"),
      code: "INTERNAL_ERROR",
    }),
  );
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    },
    500,
  );
});
export default app;
