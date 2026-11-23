import { expect, type Page } from "@playwright/test";
import type postgres from "postgres";
import { randomUUID } from "node:crypto";

/** Exercise the same owner and enrolled staff sessions used by the invite journey. */
export async function checkAdminModules(
  owner: Page,
  staff: Page,
  email: string,
  sql: postgres.Sql,
) {
  const admin = await owner.context().newPage();
  const origin = new URL(owner.url()).origin;
  const name = "Local business " + randomUUID();
  const [previous] =
    await sql`SELECT data, updated_by, version, updated_at FROM business_settings WHERE singleton`;
  try {
    await admin.goto(origin + "/app/admin");
    await admin.getByRole("link", { name: "Open Business settings" }).click();
    const field = admin.getByLabel("Business name", { exact: true });
    await field.fill(name);
    await admin.getByRole("link", { name: "Audit trail", exact: true }).click();
    await admin.getByRole("button", { name: "Keep editing" }).click();
    await expect(field).toHaveValue(name);
    await admin.getByRole("button", { name: "Save business settings" }).click();
    await expect(
      admin.getByRole("status").filter({ hasText: "All changes saved" }),
    ).toBeVisible();
    await admin.reload();
    await expect(field).toHaveValue(name);
    const locations = admin.getByRole("button", {
      name: "Locations & hours",
      exact: true,
    });
    await locations.click();
    await admin
      .getByRole("button", { name: "Add location", exact: true })
      .click();
    await admin
      .getByLabel("Location name", { exact: true })
      .fill("Fixture office");
    await admin
      .getByLabel("Address", { exact: true })
      .fill("24 Example Street");
    const monday = admin.getByRole("group", { name: "Monday", exact: true });
    await monday.getByRole("button", { name: "Set hours" }).click();
    await admin.getByRole("button", { name: "Copy Monday to Tue–Fri" }).click();
    await admin.getByRole("button", { name: "Save business settings" }).click();
    await expect(
      admin.getByRole("status").filter({ hasText: "All changes saved" }),
    ).toBeVisible();
    await admin.reload();
    await locations.click();
    await expect(
      admin.getByText("Monday–Friday", { exact: true }),
    ).toBeVisible();
    const saved = await (await admin.request.get("/api/business")).json();
    expect(
      (
        await admin.request.put("/api/business", {
          headers: { Origin: origin },
          data: { data: saved.data, version: saved.version - 1 },
        })
      ).status(),
    ).toBe(409);

    await admin.evaluate(() => {
      document.documentElement.dataset.navTest = "same-document";
    });
    await admin.getByRole("link", { name: "Audit trail", exact: true }).click();
    await admin.getByLabel("Event type").selectOption("business.updated");
    await admin.getByRole("button", { name: "Apply audit filters" }).click();
    await expect(admin).toHaveURL(/action=business.updated/);
    await expect(
      admin
        .getByRole("heading", { name: "Business settings saved", exact: true })
        .first(),
    ).toBeVisible();
    await expect(admin.locator("html")).toHaveAttribute(
      "data-nav-test",
      "same-document",
    );
    await admin.getByRole("link", { name: "Team", exact: true }).click();
    const member = admin.getByRole("region", {
      name: "Member " + email,
      exact: true,
    });
    const grant = member.locator('input[value="users:read"]');
    async function saveGrant(enabled: boolean) {
      await grant.setChecked(enabled);
      const response = admin.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.url().includes("/api/team/members/"),
      );
      await member.getByRole("button", { name: "Save permissions" }).click();
      expect((await response).status()).toBe(200);
      await expect(grant).toBeEnabled();
    }
    await saveGrant(true);
    await staff.reload();
    await staff.getByRole("link", { name: "Accounts", exact: true }).click();
    await staff.getByLabel("Search accounts").fill(email);
    await staff.getByRole("button", { name: "Search", exact: true }).click();
    await expect(
      staff.getByRole("status").filter({ hasText: "1 account matching" }),
    ).toBeVisible();
    for (const path of ["/api/team", "/api/business", "/api/audit"]) {
      expect((await staff.request.get(path)).status()).toBe(403);
    }
    await admin.screenshot({ path: "/tmp/aih-admin-team-verified.png" });
    await saveGrant(false);
    expect((await staff.request.get("/api/admin/users")).status()).toBe(403);
    await staff.reload();
    await expect(staff.getByRole("main").getByRole("alert")).toContainText(
      "does not have access",
    );
    await expect(staff.getByLabel("Search accounts")).toHaveCount(0);
  } finally {
    await admin.close();
    if (previous)
      await sql`UPDATE business_settings SET data=${sql.json(previous.data)},updated_by=${previous.updated_by},version=${previous.version},updated_at=${previous.updated_at} WHERE singleton AND data->>'name'=${name}`;
    else
      await sql`DELETE FROM business_settings WHERE singleton AND data->>'name'=${name}`;
  }
}
