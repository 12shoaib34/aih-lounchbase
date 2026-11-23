-- A database guard closes the race between account deletion and owner bootstrap.
CREATE FUNCTION prevent_owner_account_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM team_members WHERE user_id = OLD.id AND role = 'owner') THEN
    RAISE EXCEPTION 'Owner account cannot be deleted' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER protect_owner_account BEFORE DELETE ON "user"
FOR EACH ROW EXECUTE FUNCTION prevent_owner_account_deletion();
