import { z } from "zod";
export const profileInput = z.object({
  displayName: z.string().trim().min(1).max(100),
});
export const profileResponse = z.object({ displayName: z.string() });
