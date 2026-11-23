import { z } from "zod";
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from "better-auth/api";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { Pool } from "pg";
import { actionEmail } from "./email-templates";
import { authConfiguration, type AuthBindings } from "./auth-configuration";
export { authConfiguration, type AuthBindings } from "./auth-configuration";

// Request-scoped: no database sockets are shared across Workers requests.
export function createAuth(env: AuthBindings) {
  const config = authConfiguration(env);
  if (!config) return null;
  const pool = new Pool({
    connectionString: config.connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
  });
  // pg emits idle socket failures with the client attached. Keep connection details private.
  let closing = false;
  pool.on("error", () => {
    if (!closing) console.error("Account database connection interrupted");
  });
  async function send(to: string, subject: string, url: string) {
    const template = actionEmail(subject, url);
    if (env.AUTH_EMAIL_MODE === "outbox") {
      await pool.query(
        "INSERT INTO auth_mail_outbox (recipient, subject, url, body) VALUES ($1, $2, $3, $4)",
        [to, subject, url, template.text],
      );
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        text: template.text,
        html: template.html,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Email delivery failed.");
  }
  async function assertDeletable(userId: string) {
    const result = await pool.query(
      "SELECT 1 FROM team_members WHERE user_id = $1 AND role = 'owner'",
      [userId],
    );
    if (result.rowCount)
      throw new APIError("FORBIDDEN", {
        code: "OWNER_ACCOUNT_PROTECTED",
        message:
          "The owner account cannot be deleted. Contact the deployment operator about ownership transfer.",
      });
  }
  const auth = betterAuth({
    plugins: [twoFactor({ issuer: "Client account" })],
    hooks: {
      after: createAuthMiddleware(async (ctx) => {
        if (
          ![
            "/two-factor/verify-totp",
            "/two-factor/verify-backup-code",
          ].includes(ctx.path)
        )
          return;
        // Only a successful library verification response can create proof.
        const verified = z
          .object({ token: z.string(), user: z.object({ id: z.string() }) })
          .safeParse(ctx.context.returned);
        if (!verified.success) return;
        const token =
          ctx.context.newSession?.session.token ?? verified.data.token;
        await pool.query(
          `INSERT INTO session_mfa_proof (session_id)
          SELECT s.id FROM "session" s JOIN "user" u ON u.id = s."userId"
          WHERE s.token = $1 AND u.id = $2 AND u."twoFactorEnabled" = true
            AND s."expiresAt" > now()
            AND EXISTS (SELECT 1 FROM "twoFactor" t WHERE t."userId" = u.id AND t.verified = true)
          ON CONFLICT (session_id) DO UPDATE SET verified_at = now()`,
          [token, verified.data.user.id],
        );
      }),
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/delete-user") {
          const session = await getSessionFromCtx(ctx, {
            disableCookieCache: true,
          });
          if (session) await assertDeletable(session.user.id);
        }
        if (ctx.path === "/change-password")
          return {
            context: {
              ...ctx,
              body: { ...ctx.body, revokeOtherSessions: true },
            },
          };
      }),
    },
    database: pool,
    secret: config.secret,
    baseURL: config.origin,
    trustedOrigins: [config.origin],
    emailAndPassword: {
      enabled: true,
      disableSignUp: env.AUTH_ALLOW_SIGNUP !== "true",
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        send(user.email, "Reset your password", url),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        send(user.email, "Verify your email", url),
    },
    user: {
      changeEmail: {
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, url }) =>
          send(user.email, "Approve email change", url),
      },
      deleteUser: {
        enabled: true,
        deleteTokenExpiresIn: 60 * 60,
        sendDeleteAccountVerification: async ({ user, url }) => {
          await assertDeletable(user.id);
          await send(user.email, "Confirm account deletion", url);
        },
        beforeDelete: async (user) => assertDeletable(user.id),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24,
      updateAge: 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 60,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/change-password": { window: 60, max: 5 },
        "/change-email": { window: 60, max: 3 },
        "/delete-user": { window: 60, max: 3 },
      },
    },
    advanced: {
      database: { joins: true },
      useSecureCookies: !config.local,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    logger: { disabled: true },
  });
  return {
    auth,
    database: pool,
    sendEmail: send,
    close: () => {
      closing = true;
      return pool.end();
    },
  };
}
