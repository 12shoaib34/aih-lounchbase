import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    // Reject control characters in human-readable public metadata.
    // eslint-disable-next-line no-control-regex
    .regex(/^[^\u0000-\u001f\u007f]+$/);
export const productSchema = z.strictObject({
  name: text(80),
  // Leave space for environment suffixes in Worker names.
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  description: text(200),
});

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}
