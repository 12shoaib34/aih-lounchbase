import { z } from "zod";
export const enquiryStatus = z.enum([
  "Received",
  "Under review",
  "In progress",
  "Closed",
]);
export const enquirySummary = z.object({
  id: z.uuid(),
  status: enquiryStatus,
  service: z.string(),
  received: z.string(),
});
export const inboxRow = enquirySummary.extend({
  version: z.number(),
  payload: z.record(z.string(), z.union([z.string(), z.boolean()])),
});
export const inboxResponse = z.object({
  items: z.array(inboxRow),
  more: z.boolean(),
});
