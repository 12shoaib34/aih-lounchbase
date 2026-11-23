-- Revoke already-issued sessions atomically with a committed MFA state change.
-- Better Auth creates the requesting replacement session after this update.
CREATE FUNCTION revoke_sessions_on_mfa_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "session" WHERE "userId" = NEW.id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER revoke_mfa_sessions AFTER UPDATE OF "twoFactorEnabled" ON "user"
FOR EACH ROW
WHEN (COALESCE(OLD."twoFactorEnabled", false) IS DISTINCT FROM COALESCE(NEW."twoFactorEnabled", false))
EXECUTE FUNCTION revoke_sessions_on_mfa_change();
