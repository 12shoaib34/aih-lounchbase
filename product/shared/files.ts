import { z } from "zod";
export const fileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  size: z.number().int(),
  type: z.string(),
});
export const filesSchema = z.object({
  items: z.array(fileSchema),
  page: z.number().int(),
  total: z.number().int(),
  storage: z.object({
    usedBytes: z.number().int().nonnegative(),
    usedCount: z.number().int().nonnegative(),
    maxBytes: z.number().int().positive().nullable(),
    maxCount: z.number().int().positive().nullable(),
  }),
});
export const fileTypes = [
  "image/png",
  "image/jpeg",
  "application/pdf",
] as const;
export const maxFileSize = 5 * 1024 * 1024;

export const fileIntegritySchema = z.object({
  items: z.array(
    fileSchema.extend({
      state: z.enum(["healthy", "missing", "damaged", "unavailable"]),
    }),
  ),
  next: z.uuid().nullable(),
  checkedAt: z.string(),
});
export const storageObjectsSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      size: z.number(),
      state: z.enum(["referenced", "unreferenced", "unrecognized"]),
    }),
  ),
  next: z.string().nullable(),
  checkedAt: z.string(),
});
export type ManagedFile = z.infer<typeof fileSchema>;

export const fileScanHistorySchema = z.object({
  canPreserve: z.boolean(),
  items: z.array(
    z.object({
      id: z.string(),
      actorId: z.string(),
      kind: z.enum(["integrity", "objects"]),
      startedAt: z.string(),
      finishedAt: z.string(),
      continued: z.boolean(),
      hasMore: z.boolean(),
      items: z.array(
        z.object({
          reference: z.uuid().nullable(),
          size: z.number(),
          state: z.enum([
            "healthy",
            "missing",
            "damaged",
            "unavailable",
            "referenced",
            "unreferenced",
            "unrecognized",
          ]),
        }),
      ),
    }),
  ),
});

export const objectInvestigationSchema = z.object({
  reference: z.uuid(),
  observedAt: z.string(),
  checkedAt: z.string(),
  state: z.enum(["referenced", "unreferenced", "absent", "unavailable"]),
  size: z.number().int().nonnegative().nullable(),
});
