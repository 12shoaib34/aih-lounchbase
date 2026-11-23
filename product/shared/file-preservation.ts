import { z } from "zod";

export const preservationSchema = z
  .object({
    format: z.literal("launchbase-orphan-preservation-v1"),
    reference: z.uuid(),
    storageVersion: z.string().min(1).max(256),
    capturedAt: z.iso.datetime(),
    observedAt: z.iso.datetime(),
    size: z
      .number()
      .int()
      .min(0)
      .max(5 * 1024 * 1024),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.string().max(6990508),
  })
  .strict();
