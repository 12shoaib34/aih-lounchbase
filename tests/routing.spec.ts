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
  await expect(page.getByRole("heading", { name: "Account access" })).toBeVisible();
  await page.getByRole("link", { name: "Return to work" }).click();
  await expect(page.getByRole("heading", { name: "SabiWorkers." })).toBeVisible();
  expect(documents).toEqual([]);
  await expect(page.locator("html")).toHaveAttribute("data-fixture", "original");
});

test("direct entry, HTML, Hono and missing URLs", async ({ request }) => {
  const work = await request.get("/work");
  expect(work.status()).toBe(200);
  expect(await work.text()).toContain("<h3>FoodChoo</h3>");
  const account = await request.get("/app");
  expect(account.url()).toMatch(/\/app\/account$/);
  expect(await account.text()).toContain("noindex");
  expect(await (await request.get("/api/health")).json()).toEqual({ status: "ok" });
  for (const url of ["/missing", "/app/missing"]) expect((await request.get(url)).status()).toBe(404);
});
