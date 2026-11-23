import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

test.beforeAll(async () => {
  const sql = postgres(
    "postgres://postgres:postgres@127.0.0.1:54441/identity_fixture",
  );
  try {
    await sql`DELETE FROM "rateLimit"`;
  } finally {
    await sql.end();
  }
});

test("customer records persist, recover conflicts, guard drafts, filter, paginate, and archive", async ({
  page,
}, testInfo) => {
  const sql = postgres(
    "postgres://postgres:postgres@127.0.0.1:54441/identity_fixture",
  );
  const email = `records-${randomUUID()}@example.com`;
  const password = "A long records browser password 123!";
  try {
    await page.goto("/app/workspace");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Sign in",
    );
    await page.getByRole("link", { name: "Go to account access" }).click();
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await page.getByLabel("Name", { exact: true }).fill("Records browser user");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Check your email");
    const [mail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${email} ORDER BY id DESC LIMIT 1`;
    await page.goto(mail.url);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("link", { name: "Open my workspace", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "No records yet" }),
    ).toBeVisible();
    await expect(page.getByRole("main")).toBeFocused();
    const initialViewport = page.viewportSize()!;
    for (const width of [1280, 900, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator("html").evaluate((el) => {
        el.style.fontSize = "200%";
      });
      const pagination = page.getByRole("navigation", {
        name: "Record pages",
        exact: true,
      });
      const bounds = (await pagination.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(
        await pagination.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
    }
    await page.locator("html").evaluate((el) => {
      el.style.fontSize = "";
    });
    await page.setViewportSize(initialViewport);

    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    const create = page.getByRole("dialog", {
      name: "Create record",
      exact: true,
    });
    await create.getByRole("button", { name: "Save record" }).click();
    await expect(
      create.getByText("Enter a title.", { exact: true }),
    ).toBeVisible();
    await expect(create.getByLabel("Record title")).toBeFocused();
    await create.getByLabel("Record title").fill("Unsaved draft");
    await page.evaluate(() => history.back());
    await expect(
      create.getByText("Discard your unsaved changes?"),
    ).toBeVisible();
    await create.getByRole("button", { name: "Keep editing" }).click();
    await expect(create.getByLabel("Record title")).toHaveValue(
      "Unsaved draft",
    );
    await page.keyboard.press("Escape");
    await expect(
      create.getByText("Discard your unsaved changes?"),
    ).toBeVisible();
    await create.getByRole("button", { name: "Discard changes" }).click();
    await expect(create).not.toBeVisible();
    await page
      .getByRole("button", { name: "Create record", exact: true })
      .click();
    await create.getByLabel("Record title").fill("First persistent record");
    // Commit to the real Worker, then lose the response: retry must not duplicate the row.
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/records", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await held;
      await route.abort("failed");
      await page.unroute("**/api/records");
    });
    await create.getByRole("button", { name: "Save record" }).click();
    try {
      expect(await page.evaluate(()=>window.dispatchEvent(new Event("launchbase:before-session-end",{cancelable:true})))).toBe(false);
      await page.keyboard.press("Escape");
      await expect(create).toBeVisible();
    } finally { release(); }
    await expect(create.getByRole("alert")).toContainText(
      "could not confirm the save",
    );
    await create.getByRole("button", { name: "Save record" }).click();
    await expect(create).not.toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "First persistent record",
        exact: true,
      }),
    ).toBeVisible();
    const [user] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
    const rows =
      await sql`SELECT id FROM reference_records WHERE owner_id = ${user.id}`;
    expect(rows).toHaveLength(1);
    const id = rows[0].id as string;
    await page.reload();
    await page
      .getByRole("button", {
        name: "Edit First persistent record",
        exact: true,
      })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit record", exact: true });
    await edit.getByLabel("Record title").fill("My local edit");
    await sql`UPDATE reference_records SET title = 'Concurrent edit', version = version + 1 WHERE id = ${id}`;
    await edit.getByRole("button", { name: "Save record" }).click();
    await expect(edit.getByRole("alert")).toContainText("record changed");
    await expect(edit.getByLabel("Record title")).toHaveValue("My local edit");

    await edit.getByRole("button", { name: "Load latest record" }).click();
    await page
      .locator(".dialog-confirmation")
      .locator("[data-confirm-action]")
      .click();
    await expect(edit.getByLabel("Record title")).toHaveValue(
      "Concurrent edit",
    );
    await edit.getByLabel("Record title").fill("Final saved record");
    await edit.getByRole("button", { name: "Save record" }).click();
    await expect(edit).not.toBeVisible();
    // Additional real database rows exercise pagination without repetitive form setup.
    for (let i = 1; i <= 6; i++)
      await sql`INSERT INTO reference_records (id, owner_id, title) VALUES (${randomUUID()}, ${user.id}, ${`Example ${i}`})`;
    await page.getByLabel("Records per page").selectOption("5");
    await page.getByLabel("Sort records").selectOption("title");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("article")).toHaveCount(5);
    await expect(page.getByText("Page 1 of 2", { exact: true })).toBeVisible();
    await page.getByLabel("Select active records on this page").check();
    await expect(
      page.getByText("7 records · 5 selected", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("article")).toHaveCount(2);
    await expect(
      page.getByText("7 records · 0 selected", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Search records").fill("Final saved");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel("Search records")).toHaveValue("Final saved");
    await page.getByLabel("Select Final saved record", { exact: true }).check();
    await page.getByRole("button", { name: "Archive selected" }).click();
    const archive = page.getByRole("dialog", {
      name: "Archive selected records",
    });
    await sql`UPDATE reference_records SET version = version + 1 WHERE id = ${id}`;
    await archive.getByRole("button", { name: "Confirm archive" }).click();
    await expect(archive.getByRole("alert")).toContainText(
      "Some records changed",
    );
    await archive.getByRole("button", { name: "Refresh selection" }).click();
    await expect(
      page.getByRole("button", { name: "Archive selected" }),
    ).toBeDisabled();
    await page.getByLabel("Select Final saved record", { exact: true }).check();
    await page.getByRole("button", { name: "Archive selected" }).click();
    await archive.getByRole("button", { name: "Confirm archive" }).click();
    await expect(archive).not.toBeVisible();
    await expect(
      page.getByRole("article").getByText("Archived", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Filter by status").selectOption("active");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      page.getByRole("heading", { name: "No matching records" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();
    await expect(page.getByRole("article")).toHaveCount(7);
    await page.screenshot({
      path: testInfo.outputPath("workspace.png"),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  } finally {
    await sql`DELETE FROM "user" WHERE email = ${email}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ${email}`;
    await sql.end();
  }
});
