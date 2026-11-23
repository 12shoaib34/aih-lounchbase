CREATE TABLE profiles (
  user_id text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 100),
  updated_at timestamptz NOT NULL DEFAULT now()
);
