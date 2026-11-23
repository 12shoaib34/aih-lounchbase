import { z } from "zod";
export const recordFields = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Enter a title.")
    .max(120, "Use 120 characters or fewer."),
  status: z.enum(["active", "archived"]),
});
export const createRecord = recordFields.extend({ id: z.uuid() });
export const updateRecord = recordFields.extend({
  version: z.number().int().positive(),
});
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  search: z.string().trim().max(100).default(""),
  status: z.enum(["all", "active", "archived"]).default("all"),
  sort: z.enum(["newest", "oldest", "title"]).default("newest"),
  scope: z.enum(["own", "all"]).default("own"),
});
export const recordSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.enum(["active", "archived"]),
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type RecordItem = z.infer<typeof recordSchema>;
export const recordsPage = z.object({
  items: z.array(recordSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export const bulkArchive = z
  .object({
    items: z
      .array(z.object({ id: z.uuid(), version: z.number().int().positive() }))
      .min(1)
      .max(50),
  })
  .refine(
    (data) =>
      new Set(data.items.map((item) => item.id)).size === data.items.length,
    "Duplicate selections are not allowed.",
  );
