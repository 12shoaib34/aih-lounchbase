CREATE TABLE managed_files (
  id uuid PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
  type text NOT NULL CHECK (type IN ('image/png', 'image/jpeg', 'application/pdf')),
  size integer NOT NULL CHECK (size BETWEEN 1 AND 5242880),
  checksum text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
