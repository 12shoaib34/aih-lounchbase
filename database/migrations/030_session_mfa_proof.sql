-- Proof is bound to one server session and disappears on revocation/expiry cleanup.
CREATE TABLE session_mfa_proof (
  session_id text PRIMARY KEY REFERENCES "session"(id) ON DELETE CASCADE,
  verified_at timestamptz NOT NULL DEFAULT now()
);
