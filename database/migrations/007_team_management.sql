ALTER TABLE team_members ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE team_invitations ADD COLUMN revoked_at timestamptz;
CREATE INDEX team_invitations_created_at ON team_invitations(created_at);
