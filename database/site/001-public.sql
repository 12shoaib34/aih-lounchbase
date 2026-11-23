CREATE TABLE IF NOT EXISTS site_enquiries (
  id uuid PRIMARY KEY, payload jsonb NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS site_notifications (
  enquiry_id uuid PRIMARY KEY REFERENCES site_enquiries(id), attempts integer NOT NULL DEFAULT 0,
  first_attempt timestamptz, next_attempt timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz
);
CREATE TABLE IF NOT EXISTS site_submission_windows (bucket text PRIMARY KEY, count integer NOT NULL, expires integer NOT NULL);
CREATE TABLE IF NOT EXISTS site_posts (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL, excerpt text NOT NULL DEFAULT '', content text NOT NULL, published_at timestamptz
);

ALTER TABLE site_enquiries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Received'
  CHECK (status IN ('Received', 'Under review', 'In progress', 'Closed'));
ALTER TABLE site_enquiries ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS site_enquiries_inbox ON site_enquiries(received_at DESC, id DESC);

-- Only new submissions and explicit renewal requests queue mail. Never bulk-email legacy enquiries.
CREATE TABLE IF NOT EXISTS site_tracking_access (
  enquiry_id uuid PRIMARY KEY REFERENCES site_enquiries(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL, pending_token text, issued_at timestamptz NOT NULL DEFAULT now(),
  next_attempt timestamptz NOT NULL DEFAULT now(), used_at timestamptz,
  session_hash text UNIQUE, session_until timestamptz
);

-- Earlier receipts encoded the JSON object as a JSON string. Restore the object
-- so existing briefs stay readable and retries compare against the same payload.
UPDATE site_enquiries SET payload=(payload #>> '{}')::jsonb
WHERE jsonb_typeof(payload)='string' AND (payload #>> '{}') IS JSON OBJECT;
ALTER TABLE site_tracking_access ADD COLUMN IF NOT EXISTS window_started timestamptz NOT NULL DEFAULT now();
ALTER TABLE site_tracking_access ADD COLUMN IF NOT EXISTS links_issued integer NOT NULL DEFAULT 1;
