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
