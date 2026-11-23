ALTER TABLE user_permissions DROP CONSTRAINT user_permissions_permission_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_check CHECK (permission IN ('users:read', 'records:read:any', 'team:manage', 'contacts:read', 'contacts:write', 'contacts:import', 'contacts:export'));
ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_before_permissions_check;
ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_after_permissions_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_before_permissions_check CHECK (before_permissions IS NULL OR (jsonb_typeof(before_permissions) = 'array' AND before_permissions <@ '["users:read","records:read:any","team:manage","contacts:read","contacts:write","contacts:import","contacts:export"]'::jsonb));
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_after_permissions_check CHECK (after_permissions IS NULL OR (jsonb_typeof(after_permissions) = 'array' AND after_permissions <@ '["users:read","records:read:any","team:manage","contacts:read","contacts:write","contacts:import","contacts:export"]'::jsonb));
ALTER TABLE team_invitations ADD CONSTRAINT team_invitations_permissions_check CHECK (jsonb_typeof(permissions) = 'array' AND permissions <@ '["users:read","records:read:any","contacts:read","contacts:write","contacts:import","contacts:export"]'::jsonb);
