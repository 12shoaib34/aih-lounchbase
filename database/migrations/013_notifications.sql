CREATE TABLE notification_jobs (
  id uuid PRIMARY KEY,
  recipient_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  due_at timestamptz NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'delivered', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);
CREATE INDEX notification_jobs_due ON notification_jobs(due_at, id) WHERE state = 'pending';
CREATE TABLE notifications (
  id uuid PRIMARY KEY REFERENCES notification_jobs(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_recipient ON notifications(recipient_id, created_at DESC, id);
