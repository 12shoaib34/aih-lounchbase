CREATE TABLE user_permissions (
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN ('users:read', 'records:read:any')),
  PRIMARY KEY (user_id, permission)
);
-- Removable reference feature: demonstrates authorized CRUD, pagination and conflicts.
CREATE TABLE reference_records (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reference_records_owner_created ON reference_records(owner_id, created_at DESC, id);
