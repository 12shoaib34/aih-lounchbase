CREATE TABLE billing_invoices (
  id uuid PRIMARY KEY,
  number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  customer_id text REFERENCES "user"(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  currency text NOT NULL,
  amount integer NOT NULL CHECK (amount > 0),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  version integer NOT NULL DEFAULT 1,
  payment_source text CHECK (payment_source IN ('manual', 'stripe')),
  payment_reference text,
  checkout_session_id text UNIQUE,
  checkout_url text,
  checkout_expires_at timestamptz,
  checkout_generation integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX billing_invoices_customer ON billing_invoices(customer_id, created_at DESC);
CREATE TABLE billing_provider_events (
  id text PRIMARY KEY,
  invoice_id uuid,
  outcome text NOT NULL CHECK (outcome IN ('applied', 'ignored', 'review')),
  created_at timestamptz NOT NULL DEFAULT now()
);
