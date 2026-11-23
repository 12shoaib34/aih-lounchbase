import { expect, it } from "vitest";
import { withinHours } from "../../shared/scheduling";
import { providerAmount } from "../../server/billing";

it("checks every elapsed minute across both NY daylight-saving transitions", () => {
  const allows = (from: string, to: string, opens: string, closes: string) =>
    withinHours(new Date(from), new Date(to), {
      name: "Room",
      timezone: "America/New_York",
      hours: [{ day: 0, opens, closes }],
    });
  expect(
    allows("2026-11-01T05:50Z", "2026-11-01T06:10Z", "01:45", "02:00"),
  ).toBe(false);
  expect(
    allows("2026-11-01T05:50Z", "2026-11-01T06:10Z", "01:00", "02:00"),
  ).toBe(true);
  expect(
    allows("2026-03-08T06:50Z", "2026-03-08T07:10Z", "01:00", "03:10"),
  ).toBe(true);
  expect(
    allows("2026-03-08T06:50Z", "2026-03-08T07:11Z", "01:00", "03:10"),
  ).toBe(false);
});
it("converts only the special Stripe charge currencies", () => {
  for (const code of ["ISK", "ugx"])
    expect(providerAmount(400, code)).toBe(40000);
  for (const code of ["USD", "JPY", "KWD"])
    expect(providerAmount(400, code)).toBe(400);
});
