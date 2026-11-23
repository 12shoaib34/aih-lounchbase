-- Persist an attempt before calling the provider, including when its response is lost.
ALTER TABLE billing_invoices ADD COLUMN checkout_attempt_at timestamptz;
UPDATE billing_invoices SET checkout_attempt_at = created_at WHERE checkout_session_id IS NOT NULL;
