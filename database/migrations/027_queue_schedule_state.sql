-- Bounded operational state, not an unbounded execution log.
CREATE TABLE queue_schedule_state (
  name text PRIMARY KEY CHECK (name = 'notifications'),
  run_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  email_enabled boolean NOT NULL,
  last_success_at timestamptz,
  last_email_success_at timestamptz
);
