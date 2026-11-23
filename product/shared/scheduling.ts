import { z } from "zod";
import { businessInput } from "./business";
export const resourceInput = z.object({
  name: z.string().trim().min(1).max(120),
  timezone: businessInput.shape.timezone,
  hours: businessInput.shape.locations.element.shape.hours,
});
export const resourceSchema = z.object({ id: z.uuid(), data: resourceInput });
export const resourcesSchema = z.object({ items: z.array(resourceSchema) });
export const bookingInput = z.object({
  id: z.uuid(),
  resourceId: z.uuid(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
export const bookingsSchema = z.object({
  items: z.array(
    z.object({
      id: z.uuid(),
      resourceId: z.uuid(),
      resourceName: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      status: z.enum(["confirmed", "cancelled"]),
    }),
  ),
});
export function withinHours(
  start: Date,
  end: Date,
  resource: z.infer<typeof resourceInput>,
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resource.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = (date: Date) =>
    Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value]),
    );
  const minutes = (end.getTime() - start.getTime()) / 60000;
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 480) return false;
  const first = parts(start);
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    first.weekday,
  );
  let periods = resource.hours.filter((period) => period.day === day);
  // Walk real elapsed minutes so a daylight-saving fold cannot hide a closure.
  for (let i = 0; i < minutes && periods.length; i++) {
    const local = i ? parts(new Date(start.getTime() + i * 60000)) : first;
    if (
      local.day !== first.day ||
      local.month !== first.month ||
      local.year !== first.year
    )
      return false;
    const time = local.hour + ":" + local.minute;
    periods = periods.filter(
      (period) => time >= period.opens && time < period.closes,
    );
  }
  return periods.length > 0;
}
