import { z } from "zod";

// Client copies edit this list. Keep keys stable when changing question wording.
export const inquiryQuestions = z
  .array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      label: z.string().trim().min(1).max(100),
      required: z.boolean(),
    }),
  )
  .min(1)
  .max(4)
  .refine(
    (items) => new Set(items.map((item) => item.key)).size === items.length,
  )
  .parse([{ key: "request", label: "How can we help?", required: true }]);

const answer = z.string().trim().max(880);
export const inquiryInput = z
  .strictObject({
    id: z.uuid(),
    name: z.string().trim().min(1).max(120),
    email: z.email().trim().max(254),
    phone: z.string().trim().max(40).default(""),
    answers: z.record(z.string(), answer),
    website: z.string().max(512).default(""),
  })
  .refine(
    (data) =>
      Object.keys(data.answers).every((key) =>
        inquiryQuestions.some((q) => q.key === key),
      ) && inquiryQuestions.every((q) => !q.required || !!data.answers[q.key]),
    "Check the inquiry questions.",
  );

export const inquiryPageQuery = z.object({
  status: z.enum(["new", "handled"]).default("new"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export const storedInquiryAnswers = z.array(
  z.object({ key: z.string(), label: z.string(), value: z.string() }),
);
export const inquiryPageSchema = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      answers: storedInquiryAnswers,
      contactId: z.uuid().nullable(),
      createdAt: z.string(),
    }),
  ),
});
