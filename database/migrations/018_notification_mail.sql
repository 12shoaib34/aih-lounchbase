ALTER TABLE notification_jobs ADD COLUMN email_requested boolean NOT NULL DEFAULT false;
ALTER TABLE auth_mail_outbox ADD COLUMN body text;
ALTER TABLE auth_mail_outbox ADD COLUMN delivery_key text UNIQUE;
CREATE TABLE notification_preferences (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  email_enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE mail_jobs (
  id uuid PRIMARY KEY REFERENCES notification_jobs(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  html text NOT NULL,
  url text NOT NULL,
  state text NOT NULL CHECK (state IN ('pending', 'processing', 'accepted', 'failed', 'cancelled')),
  first_attempt_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mail_jobs_pending ON mail_jobs(state, next_attempt_at, lease_until);
