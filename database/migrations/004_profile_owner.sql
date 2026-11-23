-- Fail safely if an older installation has orphan profiles; resolve them explicitly.
ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE;
