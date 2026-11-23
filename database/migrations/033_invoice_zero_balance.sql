-- Fully discounted or prepaid invoices may have zero outstanding balance.
ALTER TABLE billing_invoices DROP CONSTRAINT billing_invoices_amount_check;
ALTER TABLE billing_invoices ADD CONSTRAINT billing_invoices_amount_check CHECK (amount >= 0);
