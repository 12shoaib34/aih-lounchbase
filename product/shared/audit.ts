import { z } from "zod";
import { permissionSchema } from "./access";
export const auditAction = z.enum([
  "account.mfa_recovered",
  "owner.bootstrapped",
  "owner.transferred_out",
  "owner.transferred_in",
  "invitation.created",
  "invitation.email_accepted",
  "invitation.email_failed",
  "invitation.cancelled",
  "invitation.accepted",
  "member.permissions_changed",
  "member.removed",
  "business.updated",
  "contact.created",
  "contact.imported",
  "contact.updated",
  "file.created",
  "file.restored",
  "file.deleted",
  "resource.created",
  "booking.created",
  "booking.cancelled",
  "invoice.created",
  "invoice.updated",
  "invoice.issued",
  "invoice.voided",
  "invoice.payment_recorded",
  "invoice.checkout_started",
  "invoice.checkout_created",
  "invoice.checkout_rejected",
  "invoice.checkout_recovered",
  "invoice.checkout_linked",
  "invoice.payment_confirmed",
  "payment_review.acknowledged",
]);
export const auditLabels: Record<z.infer<typeof auditAction>, string> = {
  "account.mfa_recovered": "Account factors reset by operator",
  "owner.bootstrapped": "Owner appointed",
  "owner.transferred_out": "Ownership transferred from account",
  "owner.transferred_in": "Ownership transferred to account",
  "invitation.created": "Invitation created",
  "invitation.email_accepted": "Invitation email accepted for delivery",
  "invitation.email_failed": "Invitation email failed",
  "invitation.cancelled": "Invitation cancelled",
  "invitation.accepted": "Invitation accepted",
  "member.permissions_changed": "Member permissions changed",
  "member.removed": "Member removed",
  "business.updated": "Business settings saved",
  "contact.created": "Contact created",
  "contact.imported": "Contact imported",
  "contact.updated": "Contact updated",
  "file.created": "File uploaded",
  "file.restored": "File content restored",
  "file.deleted": "File record deleted",
  "resource.created": "Scheduling resource created",
  "booking.created": "Booking created",
  "booking.cancelled": "Booking cancelled",
  "invoice.created": "Invoice created",
  "invoice.updated": "Invoice draft updated",
  "invoice.issued": "Invoice issued",
  "invoice.voided": "Invoice voided",
  "invoice.payment_recorded": "Manual payment recorded",
  "invoice.checkout_started": "Checkout attempt started",
  "invoice.checkout_rejected": "Checkout rejected by provider",
  "invoice.checkout_created": "Checkout session recorded",
  "invoice.checkout_recovered": "Expired checkout recovered",
  "invoice.checkout_linked": "Missing checkout session linked",
  "invoice.payment_confirmed": "Provider payment confirmed",
  "payment_review.acknowledged": "Payment review acknowledged",
};
export const auditTarget = z.enum([
  "account",
  "invitation",
  "business",
  "contact",
  "file",
  "resource",
  "booking",
  "invoice",
  "payment-event",
]);
const reference = z.string().min(1).max(128);
export const auditInput = z.strictObject({
  action: auditAction,
  actorId: reference,
  actorType: z.enum(["account", "service"]).default("account"),
  targetType: auditTarget,
  targetId: reference,
  requestId: z.uuid(),
  beforePermissions: z
    .array(permissionSchema)
    .max(permissionSchema.options.length)
    .optional(),
  afterPermissions: z
    .array(permissionSchema)
    .max(permissionSchema.options.length)
    .optional(),
});
export const auditQuery = z
  .object({
    action: z.union([z.literal("all"), auditAction]).default("all"),
    actor: reference.optional(),
    target: reference.optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    before: z
      .string()
      .regex(/^[1-9]\d{0,18}$/)
      .refine((value) => BigInt(value) <= 9223372036854775807n)
      .optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "The end date must not precede the start date.",
  );
export const auditPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      occurredAt: z.string(),
      action: auditAction,
      actorType: z.enum(["account", "operator", "service"]),
      actorId: z.string().nullable(),
      actorName: z.string().nullable(),
      targetType: auditTarget,
      targetId: z.string(),
      targetName: z.string().nullable(),
      requestId: z.string().nullable(),
      beforePermissions: z.array(permissionSchema).nullable(),
      afterPermissions: z.array(permissionSchema).nullable(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
