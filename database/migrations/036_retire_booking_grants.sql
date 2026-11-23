-- Booking records, historical invitations and the immutable audit trail are retained.
WITH retired AS (
  DELETE FROM user_permissions
  WHERE permission IN ('scheduling:read', 'scheduling:resources', 'scheduling:cancel')
  RETURNING user_id
)
UPDATE team_members SET version = version + 1 WHERE user_id IN (SELECT user_id FROM retired);

UPDATE team_invitations
SET permissions = permissions - ARRAY['scheduling:read', 'scheduling:resources', 'scheduling:cancel']
WHERE accepted_at IS NULL AND revoked_at IS NULL
AND permissions ?| ARRAY['scheduling:read', 'scheduling:resources', 'scheduling:cancel'];

ALTER TABLE user_permissions ADD CONSTRAINT no_retired_booking_grants
  CHECK (permission NOT IN ('scheduling:read', 'scheduling:resources', 'scheduling:cancel'));
ALTER TABLE team_invitations ADD CONSTRAINT no_pending_booking_grants
  CHECK (accepted_at IS NOT NULL OR revoked_at IS NOT NULL OR
         NOT (permissions ?| ARRAY['scheduling:read', 'scheduling:resources', 'scheduling:cancel']));
