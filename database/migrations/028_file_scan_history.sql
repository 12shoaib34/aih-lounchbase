-- Recent operational observations, not an immutable audit or consistent snapshot.
CREATE TABLE file_scan_history (
  id bigserial PRIMARY KEY,
  actor_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('integrity', 'objects')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  continued boolean NOT NULL,
  has_more boolean NOT NULL,
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) <= 100)
);
