import type { Pool } from "pg";
import type { FilePolicyBindings } from "./file-policy";
import type { MiddlewareHandler, Context } from "hono";
import { createAuth, type AuthBindings } from "./auth";
import { connectDatabase } from "./database";
import {
  hasPermission,
  permissionSchema,
  type Permission,
} from "../shared/access";
export type AppEnv = {
  Bindings: AuthBindings &
    FilePolicyBindings & {
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
    };
  Variables: {
    userId: string;
    mfaRequired: boolean;
    requestId: string;
    permissions: Permission[];
    teamRole: "owner" | "staff" | null;
    database: ReturnType<typeof connectDatabase>;
    databasePool: Pool;
  };
};
export class ApiFault extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 503,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}
export const authenticate: MiddlewareHandler<AppEnv> = async (c, next) => {
  const service = createAuth(c.env);
  if (!service)
    throw new ApiFault(503, "UNAVAILABLE", "Account access is not configured.");
  let sql: ReturnType<typeof connectDatabase> | undefined;
  try {
    if (
      !["GET", "HEAD"].includes(c.req.method) &&
      c.req.header("Origin") !== new URL(c.env.AUTH_BASE_URL!).origin
    )
      throw new ApiFault(403, "FORBIDDEN", "Invalid request origin.");
    const session = await service.auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) throw new ApiFault(401, "UNAUTHORIZED", "Please sign in.");
    // Reuse this request's authenticated connection. One live authorization
    // snapshot avoids another TLS handshake and separate role/grant/MFA trips.
    const {
      rows: [authorization],
    } = await service.database.query<{
      role: "owner" | "staff" | null;
      permissions: unknown[];
      mfa_required: boolean;
    }>(
      `SELECT m.role,
        COALESCE((SELECT json_agg(permission) FROM user_permissions
          WHERE user_id = $1), '[]'::json) AS permissions,
        ($3::boolean AND m.user_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM session_mfa_proof p
          JOIN "session" s ON s.id = p.session_id
          JOIN "user" u ON u.id = s."userId"
          WHERE s.id = $2 AND s."userId" = $1
            AND s."expiresAt" > now() AND u."twoFactorEnabled" = true
        )) AS mfa_required
       FROM (SELECT $1::text AS user_id) current_user_id
       LEFT JOIN team_members m ON m.user_id = current_user_id.user_id`,
      [
        session.user.id,
        session.session.id,
        c.env.AUTH_ADMIN_MFA_REQUIRED === "true",
      ],
    );
    c.set("userId", session.user.id);
    const mfaRequired = authorization.mfa_required;
    c.set("mfaRequired", mfaRequired);
    // Suppress all administrative role/grant paths, including owner-only routes.
    const role = mfaRequired ? null : authorization.role;
    c.set("teamRole", role ?? null);
    c.set(
      "permissions",
      role === "owner"
        ? permissionSchema.options
        : role
          ? authorization.permissions.map((permission) =>
              permissionSchema.parse(permission),
            )
          : [],
    );
    // Postgres.js connects lazily: access-only routes never open this socket.
    sql = connectDatabase(c.env);
    c.set("database", sql);
    c.set("databasePool", service.database);
    await next();
  } finally {
    await sql?.end();
    await service.close();
  }
};
export function requirePermission(
  permission: Permission,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (!hasPermission(c.get("permissions"), permission))
      throw new ApiFault(
        403,
        "FORBIDDEN",
        "You do not have access to this action.",
      );
    await next();
  };
}

export function allowed(c: Context<AppEnv>, permission: Permission) {
  return hasPermission(c.get("permissions"), permission);
}
