import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";

export async function checkContactsAndFiles(
  owner: Page,
  staff: Page,
  email: string,
  sql: postgres.Sql,
) {
  const page = await owner.context().newPage();
  const origin = new URL(owner.url()).origin,
    headers = { Origin: origin };
  const name = "Fixture " + randomUUID(),
    fileName = randomUUID() + ".png";
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRjEAAAAASUVORK5CYII=",
    "base64",
  );
  let filePath = "";
  try {
    await page.goto(origin + "/app/admin/contacts");
    await page.getByRole("button", { name: "Add contact" }).click();
    await page.getByLabel("Contact name").fill(name);
    await page
      .getByRole("textbox", { name: "Private notes" })
      .fill("Fixture note");
    await page.getByRole("button", { name: "Save contact" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    await page.getByLabel("Search contacts").fill(name);
    await expect(page.getByLabel("Search contacts")).toHaveValue(name);
    await page
      .getByRole("button", { name: "Search contacts", exact: true })
      .click();
    await expect(page).toHaveURL(/search=/);
    const listUrl = page.url();
    await page.evaluate(() => {
      document.documentElement.dataset.contactsNav = "same";
    });
    await page.getByRole("link", { name, exact: true }).click();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    const contactPath =
      "/api/contacts/" + new URL(page.url()).pathname.split("/").pop();
    await expect(page.locator("html")).toHaveAttribute(
      "data-contacts-nav",
      "same",
    );
    const initial = await (await page.request.get(contactPath)).json();
    await page.getByRole("button", { name: "Edit contact" }).click();
    await page
      .getByRole("textbox", { name: "Private notes" })
      .fill("Updated fixture note");
    const persisted = page.waitForResponse(response =>
      new URL(response.url()).pathname === contactPath && response.request().method() === "PUT");
    await page.getByRole("button", { name: "Save contact" }).click();
    expect((await persisted).status()).toBe(200);
    await expect(
      page.getByText("Updated fixture note", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await page.request.put(contactPath, {
          headers,
          data: { data: initial.data, version: initial.version },
        })
      ).status(),
    ).toBe(409);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(
      page.getByText("Updated fixture note", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: "/tmp/aih-contact-mobile-verified.png" });
    await page.setViewportSize(viewport);
    await page
      .getByRole("navigation", { name: "Breadcrumb", exact: true })
      .getByRole("link", { name: "Contacts" })
      .click();
    await expect(page).toHaveURL(listUrl);
    await page.getByText("Import and export contacts", { exact: true }).click();
    await page.getByLabel("Contact CSV").setInputFiles({
      name: "fixture.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "name,company,notes,email\n" +
          name +
          " imported,Fixture,Skip this note,skip@example.invalid",
      ),
    });
    await page.getByLabel("Column for notes").selectOption("");
    await page.getByLabel("Column for email").selectOption("");
    await page.getByRole("button", { name: "Validate and preview" }).click();
    const posted = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.url().endsWith("/api/contacts/import"),
    );
    await page.getByRole("button", { name: "Import 1 contacts" }).click();
    const upload = await posted;
    expect(await upload.json()).toEqual({ inserted: 1, unchanged: 0 });
    const [imported] =
      await sql`SELECT data FROM contacts WHERE id=${upload.request().postDataJSON().items[0].id}`;
    expect(imported.data).toMatchObject({ notes: "", email: "" });
    const retry = await page.request.post("/api/contacts/import", {
      headers,
      data: upload.request().postDataJSON(),
    });
    expect(await retry.json()).toEqual({ inserted: 0, unchanged: 1 });
    expect(
      await (await page.request.get("/api/contacts/export")).text(),
    ).toContain(name + " imported");

    await page.getByRole("link", { name: "Files", exact: true }).click();
    await page
      .getByLabel("Choose file")
      .setInputFiles({ name: fileName, mimeType: "image/png", buffer: bytes });
    await page.getByRole("button", { name: "Upload file" }).click();
    const download = page.getByRole("link", { name: "Download " + fileName });
    await expect(download).toBeVisible();
    filePath = (await download.getAttribute("href"))!;
    const file = await page.request.get(filePath);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-disposition"]).toContain("attachment;");
    expect(await file.body()).toEqual(bytes);
    // Simulate loss of the fixture's SQL record after its R2 write.
    await sql`DELETE FROM managed_files WHERE id=${filePath.split("/").pop()!} AND name=${fileName}`;
    const uploadHeaders = {
      ...headers,
      "Content-Type": "image/png",
      "X-File-Name": fileName,
    };
    const changed = Buffer.concat([bytes, Buffer.from([0])]);
    expect(
      (
        await page.request.put(filePath, {
          headers: uploadHeaders,
          data: changed,
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.put(filePath, {
          headers: {
            ...headers,
            "Content-Type": "image/png",
            "X-File-Name": fileName,
          },
          data: bytes,
        })
      ).status(),
    ).toBe(200);
    expect(
      await page.evaluate(
        async (path) => (await fetch(path, { credentials: "omit" })).status,
        filePath,
      ),
    ).toBe(401);
    await page.getByRole("button", { name: "Check recorded files" }).click();
    const integrity = page
      .getByRole("table", { name: "Recorded file integrity" })
      .getByRole("row")
      .filter({ hasText: fileName });
    await expect(integrity).toContainText("healthy");
    await page.screenshot({ path: "/tmp/aih-files-verified.png" });
    await page.getByRole("link", { name: "Team", exact: true }).click();
    const member = page.getByRole("region", {
      name: "Member " + email,
      exact: true,
    });
    async function grant(read: boolean) {
      for (const key of ["contacts:read", "files:read"])
        await member.locator('input[value="' + key + '"]').setChecked(read);
      const response = page.waitForResponse(
        (r) =>
          r.request().method() === "PUT" &&
          r.url().includes("/api/team/members/"),
      );
      await member.getByRole("button", { name: "Save permissions" }).click();
      expect((await response).status()).toBe(200);
    }
    await grant(true);
    expect((await staff.request.get(contactPath)).status()).toBe(200);
    expect(
      (
        await staff.request.put(contactPath, {
          headers,
          data: { data: initial.data, version: 1 },
        })
      ).status(),
    ).toBe(403);
    expect((await staff.request.get("/api/contacts/export")).status()).toBe(
      403,
    );
    expect((await staff.request.get("/api/files")).status()).toBe(200);
    expect((await staff.request.get(filePath)).status()).toBe(403);
    expect((await staff.request.delete(filePath, { headers })).status()).toBe(
      403,
    );
    await grant(false);
    expect((await staff.request.get(contactPath)).status()).toBe(403);
    expect((await staff.request.get("/api/files")).status()).toBe(403);
    await page.getByRole("link", { name: "Files", exact: true }).click();
    await page.getByRole("button", { name: "Delete " + fileName }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete file", exact: true })
      .click();
    await expect(download).toHaveCount(0);
    expect((await page.request.get(filePath)).status()).toBe(404);
    filePath = "";
  } finally {
    if (filePath) await owner.request.delete(filePath, { headers });
    await sql`DELETE FROM contacts WHERE data->>'name' IN (${name}, ${name + " imported"})`;
    await page.close();
  }
}
