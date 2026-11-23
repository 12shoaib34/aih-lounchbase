CREATE TABLE customer_inquiries (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'array'),
  handled_at timestamptz,
  contact_id uuid UNIQUE REFERENCES contacts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (contact_id IS NULL OR handled_at IS NOT NULL)
);
CREATE INDEX inquiry_queue ON customer_inquiries ((handled_at IS NULL), created_at DESC, id DESC);

CREATE TABLE inquiry_rate_limits (
  hour timestamptz NOT NULL,
  scope text NOT NULL,
  submissions integer NOT NULL,
  PRIMARY KEY (hour, scope)
);

ALTER TABLE user_permissions DROP CONSTRAINT user_permissions_permission_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_permission_check CHECK (permission IN ('users:read', 'records:read:any', 'team:manage', 'inquiries:manage', 'contacts:read', 'contacts:write', 'contacts:import', 'contacts:export', 'scheduling:read', 'scheduling:resources', 'scheduling:cancel', 'files:read', 'files:download', 'files:write', 'files:delete', 'files:review', 'notifications:read', 'notifications:write', 'notifications:deliver', 'notifications:review', 'billing:read', 'billing:create', 'billing:edit', 'billing:issue', 'billing:void', 'billing:record-payment', 'billing:review', 'billing:checkout'));
ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_before_permissions_check;
ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_after_permissions_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_before_permissions_check CHECK (before_permissions IS NULL OR (jsonb_typeof(before_permissions) = 'array' AND before_permissions <@ '["users:read", "records:read:any", "team:manage", "inquiries:manage", "contacts:read", "contacts:write", "contacts:import", "contacts:export", "scheduling:read", "scheduling:resources", "scheduling:cancel", "files:read", "files:download", "files:write", "files:delete", "files:review", "notifications:read", "notifications:write", "notifications:deliver", "notifications:review", "billing:read", "billing:create", "billing:edit", "billing:issue", "billing:void", "billing:record-payment", "billing:review", "billing:checkout"]'::jsonb));
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_after_permissions_check CHECK (after_permissions IS NULL OR (jsonb_typeof(after_permissions) = 'array' AND after_permissions <@ '["users:read", "records:read:any", "team:manage", "inquiries:manage", "contacts:read", "contacts:write", "contacts:import", "contacts:export", "scheduling:read", "scheduling:resources", "scheduling:cancel", "files:read", "files:download", "files:write", "files:delete", "files:review", "notifications:read", "notifications:write", "notifications:deliver", "notifications:review", "billing:read", "billing:create", "billing:edit", "billing:issue", "billing:void", "billing:record-payment", "billing:review", "billing:checkout"]'::jsonb));
ALTER TABLE team_invitations DROP CONSTRAINT team_invitations_permissions_check;
ALTER TABLE team_invitations ADD CONSTRAINT team_invitations_permissions_check CHECK (jsonb_typeof(permissions) = 'array' AND permissions <@ '["users:read", "records:read:any", "inquiries:manage", "contacts:read", "contacts:write", "contacts:import", "contacts:export", "scheduling:read", "scheduling:resources", "scheduling:cancel", "files:read", "files:download", "files:write", "files:delete", "files:review", "notifications:read", "notifications:write", "notifications:deliver", "notifications:review", "billing:read", "billing:create", "billing:edit", "billing:issue", "billing:void", "billing:record-payment", "billing:review", "billing:checkout"]'::jsonb);

ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_action_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_action_check CHECK (action IN ('owner.bootstrapped', 'owner.transferred_out', 'owner.transferred_in', 'invitation.created', 'invitation.email_accepted', 'invitation.email_failed', 'invitation.cancelled', 'invitation.accepted', 'member.permissions_changed', 'member.removed', 'business.updated', 'inquiry.handled', 'inquiry.converted', 'contact.created', 'contact.imported', 'contact.updated', 'file.created', 'file.restored', 'file.deleted', 'resource.created', 'booking.created', 'booking.cancelled', 'invoice.created', 'invoice.updated', 'invoice.issued', 'invoice.voided', 'invoice.payment_recorded', 'invoice.checkout_started', 'invoice.checkout_rejected', 'invoice.checkout_created', 'invoice.payment_confirmed', 'payment_review.acknowledged', 'invoice.checkout_recovered', 'invoice.checkout_linked', 'account.mfa_recovered'));

ALTER TABLE admin_audit_events DROP CONSTRAINT admin_audit_events_target_type_check;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_target_type_check CHECK (target_type IN ('account', 'invitation', 'business', 'contact', 'file', 'resource', 'booking', 'invoice', 'payment-event', 'inquiry'));
