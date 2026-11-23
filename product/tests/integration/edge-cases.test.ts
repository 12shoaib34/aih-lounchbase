import {stripeAmount} from "../../server/billing";
import { expect, it } from "vitest";
it("converts only the special Stripe charge currencies", () => {
  for (const code of ["ISK", "ugx"])
    expect(stripeAmount(400, code)).toBe(40000);
  for (const code of ["USD", "JPY", "KWD"])
    expect(stripeAmount(400, code)).toBe(400);
});
