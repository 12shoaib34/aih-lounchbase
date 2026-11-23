CREATE TABLE admin_audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  action text NOT NULL CHECK (action IN ('owner.bootstrapped', 'invitation.created', 'invitation.email_accepted', 'invitation.email_failed', 'invitation.cancelled', 'invitation.accepted', 'member.permissions_changed', 'member.removed')),
  actor_type text NOT NULL CHECK (actor_type IN ('account', 'operator')),
  actor_id text,
  target_type text NOT NULL CHECK (target_type IN ('account', 'invitation')),
  target_id text NOT NULL CHECK (length(target_id) BETWEEN 1 AND 128),
  request_id uuid,
  before_permissions jsonb,
  after_permissions jsonb,
  CHECK ((actor_type = 'operator' AND actor_id IS NULL) OR (actor_type = 'account' AND actor_id IS NOT NULL AND length(actor_id) BETWEEN 1 AND 128)),
  CHECK (before_permissions IS NULL OR (jsonb_typeof(before_permissions) = 'array' AND before_permissions <@ '["users:read","records:read:any","team:manage"]'::jsonb)),
  CHECK (after_permissions IS NULL OR (jsonb_typeof(after_permissions) = 'array' AND after_permissions <@ '["users:read","records:read:any","team:manage"]'::jsonb))
);
-- Deliberately no identity foreign keys: deleting an account must not erase its history.
CREATE INDEX admin_audit_action_id ON admin_audit_events(action, id DESC);
CREATE INDEX admin_audit_actor_id ON admin_audit_events(actor_id, id DESC);
CREATE INDEX admin_audit_target_id ON admin_audit_events(target_id, id DESC);
CREATE INDEX admin_audit_occurred_at ON admin_audit_events(occurred_at);

CREATE FUNCTION reject_admin_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Administrative audit events are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER admin_audit_no_mutation BEFORE UPDATE OR DELETE OR TRUNCATE ON admin_audit_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_admin_audit_mutation();
