import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type postgres from "postgres";

export async function checkProductPages(
  owner: Page,
  staff: Page,
  email: string,
  sql: postgres.Sql,
) {
  const origin = new URL(owner.url()).origin;
  const headers = { Origin: origin };
  const id = randomUUID();
  const [customer] = await sql`SELECT id FROM "user" WHERE email=${email}`;
  const page = await owner.context().newPage();
  try {
    for (const [route, heading] of [
      ["admin/scheduling", "Scheduling"],
      ["admin/notifications", "Scheduled notifications"],
      ["admin/billing", "Billing"],
      ["admin/billing/new", "New invoice"],
    ]) {
      await page.goto(origin + "/app/" + route);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }).first(),
      ).toBeVisible();
    }
    const create = await owner.request.post("/api/billing", {
      headers,
      data: {
        id,
        data: {
          customerId: customer.id,
          currency: "USD",
          items: [
            {
              description: "Fixture engineering",
              quantity: 1,
              unitAmount: 10000,
            },
          ],
        },
      },
    });
    expect(create.status(), await create.text()).toBe(200);
    await page.goto(origin + "/app/admin/billing/" + id);
    const download = page.waitForEvent("download", { timeout: 12000 });
    await page.getByRole("button", { name: "Download PDF" }).click();
    const path = await (await download).path();
    expect((await readFile(path!)).subarray(0, 5).toString()).toBe("%PDF-");
    await page.goto(origin + "/app/admin/billing/" + id + "/edit");
    await expect(
      page.getByRole("heading", { name: /Edit draft/ }).first(),
    ).toBeVisible();
    for (const [route, heading] of [
      ["billing", "My billing"],
      ["bookings", "My bookings"],
      ["notifications", "Notifications"],
    ]) {
      await staff.goto(origin + "/app/account/" + route);
      await expect(
        staff.getByRole("heading", { name: heading, exact: true }).first(),
      ).toBeVisible();
    }
  } finally {
    await page.close();
    await sql`DELETE FROM billing_invoices WHERE id=${id}`;
  }
}
