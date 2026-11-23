ALTER TABLE mail_jobs ADD COLUMN last_result text CHECK (last_result IN ('accepted', 'provider_error', 'delivery_uncertain', 'recipient_ineligible', 'lease_expired', 'retry_window_expired', 'attempt_limit'));
ALTER TABLE mail_jobs ADD COLUMN reviewed_at timestamptz;
ALTER TABLE mail_jobs ADD COLUMN reviewed_by text REFERENCES "user"(id) ON DELETE SET NULL;
CREATE TABLE mail_attempts (
  job_id uuid NOT NULL REFERENCES mail_jobs(id) ON DELETE CASCADE,
  attempt integer NOT NULL CHECK (attempt BETWEEN 1 AND 5),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  outcome text NOT NULL CHECK (outcome IN ('processing', 'accepted', 'provider_error', 'delivery_uncertain', 'recipient_ineligible', 'lease_expired')),
  PRIMARY KEY (job_id, attempt)
);
