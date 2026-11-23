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
      ["admin/inquiries", "Inquiries"],
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
    await page.goto(origin + "/app/admin/billing/" + id);
    await page
      .getByRole("button", { name: "Issue invoice", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Issue invoice" })
      .click();
    const record = page.getByRole("button", {
      name: "Record payment",
      exact: true,
    });
    await record.click();
    const dialog = page.getByRole("dialog", { name: "Record payment" });
    await dialog.getByLabel(/^Amount/).fill("1");
    await dialog.getByLabel("Payment reference").fill("Transfer A");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.locator(".invoice-status")).toHaveText("Partially paid");
    await staff.goto(origin + "/app/account/billing");
    const invoice = staff
      .getByRole("article")
      .filter({ hasText: "Partially paid" });
    await expect(invoice).toContainText("99.00");
    await invoice.getByText("Payment history").click();
    await expect(invoice).toContainText("Bank transfer");
    await record.click();
    await dialog.getByLabel("Payment reference").fill("Transfer B");
    await dialog.getByRole("button", { name: "Record payment" }).click();
    await expect(page.locator(".invoice-status")).toHaveText("paid");
    for (const [route, heading] of [
      ["billing", "My billing"],
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
