import { z } from "zod";
export const notificationInput = z.object({
  email: z.boolean().default(false),
  id: z.uuid(),
  recipientId: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  dueAt: z.iso.datetime(),
});
export const notificationSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
});
export const notificationsSchema = z.object({
  items: z.array(notificationSchema),
  page: z.number(),
  total: z.number(),
});
export const jobsSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      recipientId: z.string(),
      dueAt: z.string(),
      state: z.enum(["pending", "delivered", "cancelled"]),
      emailState: z.string().nullable(),
    }),
  ),
});

export const mailReviewSchema = z.object({
  page: z.number(),
  total: z.number(),
  items: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      recipientId: z.string(),
      state: z.enum([
        "pending",
        "processing",
        "accepted",
        "failed",
        "cancelled",
      ]),
      attempts: z.number(),
      lastResult: z.string().nullable(),
      nextAttemptAt: z.string(),
      firstAttemptAt: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      reviewedBy: z.string().nullable(),
      retryWindowExpired: z.boolean(),
    }),
  ),
});
export const mailAttemptsSchema = z.object({
  items: z.array(
    z.object({
      attempt: z.number(),
      startedAt: z.string(),
      finishedAt: z.string().nullable(),
      outcome: z.string(),
    }),
  ),
});
export const mailResultLabels: Record<string, string> = {
  processing: "Attempt in progress",
  accepted: "Accepted by provider / local outbox",
  provider_error: "Provider returned an error; delivery unconfirmed",
  delivery_uncertain: "Delivery outcome unknown",
  recipient_ineligible: "Recipient opted out, changed address or is unverified",
  lease_expired: "Worker attempt expired; delivery unconfirmed",
  retry_window_expired: "Retry window expired; operator review required",
  attempt_limit: "Attempt limit reached; operator review required",
};
