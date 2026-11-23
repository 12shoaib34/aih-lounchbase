-- Matches the installed Better Auth two-factor plugin schema.
ALTER TABLE "user" ADD COLUMN "twoFactorEnabled" boolean DEFAULT false;
CREATE TABLE "twoFactor" (
  id text PRIMARY KEY,
  secret text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  verified boolean DEFAULT true,
  "failedVerificationCount" integer DEFAULT 0,
  "lockedUntil" timestamptz
);
CREATE INDEX two_factor_user ON "twoFactor"("userId");
CREATE INDEX two_factor_secret ON "twoFactor"(secret);
