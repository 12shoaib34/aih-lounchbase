import { expect, test } from "@playwright/test";

test("public and product pages share the hydrated document", async ({ page }) => {
  await page.goto("/work");
  await expect(page.getByRole("heading", { name: "FoodChoo" })).toBeVisible();
  // Next installs this history entry after hydrating the App Router.
  await page.waitForFunction(() => history.state?.__NA);
  await page.evaluate(() => { document.documentElement.dataset.fixture = "original"; });
  const documents: string[] = [];
  page.on("request", request => {
    if (request.resourceType() === "document" && request.frame() === page.mainFrame()) documents.push(request.url());
  });
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await page.getByRole("link", { name: "Return to work" }).click();
  await expect(page.getByRole("heading", { name: "Selected work" })).toBeVisible();
  expect(documents).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("data-fixture", "original");
});

test("dirty fixture can cancel, recover across history and reload, and discard", async ({ page }) => {
  await page.goto("/work");
  await page.getByRole("link", { name: "Account" }).click();
  const draft = page.getByLabel("Test draft");
  await draft.fill("Fixture only");
  await page.getByText("Return to work").click();
  await page.getByText("Keep editing").click();
  await expect(draft).toHaveValue("Fixture only");
  await page.goBack();
  await expect(page).toHaveURL(/\/work$/);
  await page.goForward();
  await expect(draft).toHaveValue("Fixture only");
  await page.reload();
  await expect(draft).toHaveValue("Fixture only");
  await page.getByText("Return to work").click();
  await page.getByText("Discard and leave").click();
  await expect(page).toHaveURL(/\/work$/);
  await page.getByRole("link", { name: "Account" }).click();
  await expect(draft).toHaveValue("");
});

test("direct entry, HTML, Hono and missing URLs", async ({ request }) => {
  const work = await request.get("/work");
  expect(work.status()).toBe(200);
  expect(await work.text()).toContain("<h2>FoodChoo</h2>");
  const account = await request.get("/app");
  expect(account.url()).toMatch(/\/app\/account$/);
  expect(await account.text()).toContain("noindex");
  expect(await (await request.get("/api/health")).json()).toEqual({ status: "ok" });
  for (const url of ["/missing", "/app/missing"]) expect((await request.get(url)).status()).toBe(404);
});

test("pending save guards navigation and session end", async ({ page }) => {
  await page.addInitScript(() => {
    const put = Cache.prototype.put;
    Cache.prototype.put = async function(request, response) {
      await new Promise<void>(resolve => window.addEventListener("fixture-release", () => resolve(), { once: true }));
      return put.call(this, request, response);
    };
  });
  await page.goto("/app/account");
  await page.getByLabel("Test draft").fill("Temporary example");
  await page.getByText("Save test draft").click();
  await page.getByText("Return to work").click();
  await expect(page.getByRole("status")).toContainText("Wait");
  expect(await page.evaluate(() => window.dispatchEvent(new Event("launchbase:before-session-end", {cancelable: true})))).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event("fixture-release")));
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByText("Return to work").click();
  await expect(page).toHaveURL(/\/work$/);
});
