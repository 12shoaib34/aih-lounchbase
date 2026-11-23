import { z } from "zod";
export const permissionSchema = z.enum([
  "users:read",
  "records:read:any",
  "team:manage",
  "contacts:read",
  "contacts:write",
  "contacts:import",
  "contacts:export",
  "scheduling:read",
  "scheduling:resources",
  "scheduling:cancel",
  "files:read",
  "files:download",
  "files:write",
  "files:delete",
  "files:review",
  "notifications:read",
  "notifications:write",
  "notifications:deliver",
  "notifications:review",
  "billing:read",
  "billing:create",
  "billing:edit",
  "billing:issue",
  "billing:void",
  "billing:record-payment",
  "billing:review",
  "billing:checkout",
]);
export type Permission = z.infer<typeof permissionSchema>;
export const accessSchema = z.object({
  mfaRequired: z.boolean().optional(),
  userId: z.string(),
  permissions: z.array(permissionSchema),
  teamRole: z.enum(["owner", "staff"]).nullable(),
});
export function hasPermission(
  permissions: readonly string[],
  required: Permission,
) {
  return (
    permissions.includes(required) &&
    (!permissionDependencies[required] ||
      permissions.includes(permissionDependencies[required]))
  );
}

export const usersPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      emailVerified: z.boolean(),
      teamRole: z.enum(["owner", "staff"]).nullable(),
    }),
  ),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export const permissionLabels: Record<Permission, string> = {
  "users:read": "View account directory",
  "records:read:any": "View all reference records",
  "team:manage": "Manage team (reserved)",
  "contacts:read": "View contacts (including notes)",
  "contacts:write": "Create, edit and archive contacts",
  "contacts:import": "Import contacts from CSV",
  "contacts:export": "Export contacts to CSV",
  "scheduling:read": "View all bookings",
  "scheduling:resources": "Create scheduling resources",
  "scheduling:cancel": "Cancel any booking",
  "files:read": "View file names and metadata",
  "files:download": "Download private files",
  "files:write": "Upload and restore files",
  "files:delete": "Delete files",
  "files:review": "Review storage integrity and references",
  "notifications:read": "View scheduled messages and email history",
  "notifications:write": "Schedule and cancel messages",
  "notifications:deliver": "Process due notification and email jobs",
  "notifications:review": "Acknowledge failed email jobs",
  "billing:read": "View all invoices including drafts",
  "billing:create": "Create draft invoices",
  "billing:edit": "Edit saved draft invoices",
  "billing:issue": "Issue invoices",
  "billing:void": "Void unpaid invoices",
  "billing:record-payment": "Record external payments",
  "billing:review": "Review payment provider events",
  "billing:checkout": "Start checkout for any issued invoice",
};

export const permissionDependencies: Partial<Record<Permission, Permission>> = {
  "contacts:write": "contacts:read",
  "contacts:import": "contacts:read",
  "contacts:export": "contacts:read",
  "scheduling:resources": "scheduling:read",
  "scheduling:cancel": "scheduling:read",
  "files:download": "files:read",
  "files:write": "files:read",
  "files:delete": "files:read",
  "files:review": "files:read",
  "notifications:write": "notifications:read",
  "notifications:deliver": "notifications:read",
  "notifications:review": "notifications:read",
  "billing:create": "billing:read",
  "billing:edit": "billing:read",
  "billing:issue": "billing:read",
  "billing:void": "billing:read",
  "billing:record-payment": "billing:read",
  "billing:review": "billing:read",
  "billing:checkout": "billing:read",
};

export const accountChoicesSchema = z.object({
  items: z.array(
    z.object({ id: z.string(), name: z.string(), email: z.string() }),
  ),
});
