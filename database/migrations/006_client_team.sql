ALTER TABLE user_permissions DROP CONSTRAINT user_permissions_permission_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_check CHECK (permission IN ('users:read', 'records:read:any', 'team:manage'));
CREATE TABLE team_members (
  user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE team_invitations (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  permissions jsonb NOT NULL,
  invited_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX team_invitations_email ON team_invitations(email);
