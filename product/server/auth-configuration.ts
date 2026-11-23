import type { DatabaseBindings } from "./database";

export type AuthBindings = DatabaseBindings & {
  APP_ENV?: string;
  TEAM_INVITES_ENABLED?: string;
  AUTH_SECRET?: string;
  AUTH_BASE_URL?: string;
  AUTH_ALLOW_SIGNUP?: string;
  AUTH_ADMIN_MFA_REQUIRED?: string;
  AUTH_EMAIL_MODE?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
};

export function authConfiguration(env: AuthBindings) {
  if (
    env.AUTH_ADMIN_MFA_REQUIRED !== undefined &&
    !["true", "false"].includes(env.AUTH_ADMIN_MFA_REQUIRED)
  )
    throw new Error("AUTH_ADMIN_MFA_REQUIRED must be true or false.");
  if (!env.AUTH_SECRET && !env.AUTH_BASE_URL) return null;
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32 || !env.AUTH_BASE_URL)
    throw new Error(
      "Auth requires a random secret of at least 32 characters and an explicit origin.",
    );
  const url = new URL(env.AUTH_BASE_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "AUTH_BASE_URL must be an HTTPS origin, or HTTP localhost.",
    );
  if (
    ["staging", "production"].includes(env.APP_ENV ?? "") &&
    (local || env.AUTH_EMAIL_MODE === "outbox")
  )
    throw new Error(
      "Hosted environments cannot use a localhost auth origin or test outbox.",
    );
  if (!["outbox", "resend"].includes(env.AUTH_EMAIL_MODE ?? ""))
    throw new Error("AUTH_EMAIL_MODE must be outbox or resend.");
  if (env.AUTH_EMAIL_MODE === "outbox" && !local)
    throw new Error(
      "The test email outbox is only allowed for a localhost auth origin.",
    );
  if (
    env.AUTH_EMAIL_MODE !== "outbox" &&
    (!env.RESEND_API_KEY || !env.EMAIL_FROM)
  )
    throw new Error(
      "Configure transactional email before enabling authentication.",
    );
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
  if (!connectionString) throw new Error("Authentication requires PostgreSQL.");
  return {
    origin: url.origin,
    local,
    connectionString,
    secret: env.AUTH_SECRET,
  };
}
