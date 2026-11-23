import { z } from "zod";
import { permissionSchema, permissionDependencies } from "./access";
export const staffPermission = permissionSchema.exclude(["team:manage"]);
export const grantsInput = z.object({
  permissions: z
    .array(staffPermission)
    .max(staffPermission.options.length)
    .refine((items) => new Set(items).size === items.length)
    .refine(
      (items) =>
        items.every(
          (item) =>
            !permissionDependencies[item] ||
            items.includes(
              permissionDependencies[
                item
              ] as (typeof staffPermission.options)[number],
            ),
        ),
      "Module actions require that module's view permission.",
    ),
  version: z.number().int().positive(),
});
export const invitationInput = z.object({
  email: z.email().trim().toLowerCase().max(254),
  permissions: grantsInput.shape.permissions,
});
export const acceptInput = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
export const teamSchema = z.object({
  invitationsEnabled: z.boolean(),
  members: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["owner", "staff"]),
      version: z.number().int(),
      permissions: z.array(permissionSchema),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      permissions: z.array(staffPermission),
      expiresAt: z.string(),
    }),
  ),
});
