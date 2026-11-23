CREATE TABLE invoice_payments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  method text NOT NULL CHECK (method IN ('Bank transfer','Cash','Cheque','Other','Stripe')),
  reference text NOT NULL,
  recorded_by text
);
CREATE INDEX invoice_payments_by_invoice ON invoice_payments(invoice_id, paid_on DESC, id DESC);
