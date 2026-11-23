import { expect, type Browser, type Page } from "@playwright/test";
import type postgres from "postgres";
import { randomUUID } from "node:crypto";

export async function checkEnquiryJourney(
  browser: Browser,
  owner: Page,
  staff: Page,
  sql: postgres.Sql,
  origin: string,
  verifiedEmail: string,
) {
  const first = await browser.newContext({
    baseURL: origin,
    viewport: { width: 390, height: 844 },
  });
  const second = await browser.newContext({ baseURL: origin });
  const alice = await first.newPage(),
    bob = await second.newPage();
  const ids: string[] = [];
  async function submit(page: Page, name: string) {
    const email = randomUUID() + "@example.com";
    await page.goto("/website-template");
    await page.getByLabel("Your name").fill(name);
    await page.getByLabel("Email address").fill(email);
    await page
      .getByLabel("Your enquiry")
      .fill("Can the team help with our booking system?");
    const receipt = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/enquiry") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send enquiry" }).click();
    const result = await receipt;
    expect(result.status()).toBe(200);
    const { reference } = await result.json();
    ids.push(reference);
    await expect(page.getByRole("status")).toContainText(reference);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const emailUrl = async () =>
      (
        await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${email} AND subject='Sign in to track your enquiry' ORDER BY id DESC LIMIT 1`
      )[0]?.url;
    await expect.poll(emailUrl).toBeTruthy();
    return { reference, email, url: await emailUrl() };
  }
  try {
    const name = "Portal fixture " + randomUUID();
    await alice.goto("/app/inquire");
    await alice.getByLabel("Name", { exact: true }).fill(name);
    await alice.getByLabel("Email", { exact: true }).fill(verifiedEmail);
    await alice
      .getByLabel("How can we help?")
      .fill("Review our booking workflow.");
    await alice.getByRole("button", { name: "Send inquiry" }).click();
    await expect(
      alice.getByRole("heading", { name: "Inquiry received" }),
    ).toBeVisible();
    const [receipt] =
      await sql`SELECT id FROM customer_inquiries WHERE email=${verifiedEmail} AND name=${name}`;
    ids.push(receipt.id);
    await staff.goto("/app/account/enquiries");
    const card = staff.getByRole("article").filter({ hasText: receipt.id });
    await expect(card).toContainText("Received");
    const unrelated = await owner.request.get(
      "/api/inquiries/mine?email=" + encodeURIComponent(verifiedEmail),
    );
    expect(unrelated.status()).toBe(200);
    expect(
      (await unrelated.json()).items.map((item: { id: string }) => item.id),
    ).not.toContain(receipt.id);
    await owner.goto("/app/admin/inquiries");
    const inquiry = owner.locator("details").filter({ hasText: name });
    await inquiry.locator("summary").click();
    await inquiry.getByRole("button", { name: "Mark handled" }).click();
    await expect(
      owner.getByRole("status").filter({ hasText: "Inquiry marked handled." }),
    ).toBeVisible();
    await staff.getByRole("button", { name: "Refresh enquiries" }).click();
    await expect(card).toContainText("Under review");
    const a = await submit(alice, "Tracking fixture A"),
      b = await submit(bob, "Tracking fixture B");
    expect((await alice.request.get("/api/admin/enquiries")).status()).toBe(
      401,
    );
    expect((await staff.request.get("/api/admin/enquiries")).status()).toBe(
      403,
    );
    await owner.goto("/app/admin");
    await owner
      .getByRole("link", { name: "Enquiry tracking", exact: true })
      .click();
    const item = owner.locator("details").filter({ hasText: a.reference });
    await item.locator("summary").click();
    await expect(item).toContainText(a.email);
    await item.getByLabel("Enquiry status").selectOption("Under review");
    await expect(
      owner.getByRole("status").filter({ hasText: "Status saved." }),
    ).toBeVisible();
    expect(
      (
        await owner.request.patch("/api/admin/enquiries/" + a.reference, {
          headers: { Origin: origin },
          data: { status: "Closed", version: 1 },
        })
      ).status(),
    ).toBe(409);
    await alice.goto(a.url);
    expect((await alice.request.get("/api/tracking")).status()).toBe(401);
    await alice.getByRole("button", { name: "Sign in to view status" }).click();
    await expect(
      alice.getByText("Under review", { exact: true }),
    ).toBeVisible();
    await alice.reload();
    await expect(alice.getByText(a.reference, { exact: true })).toBeVisible();
    await bob.goto(b.url);
    await bob.getByRole("button", { name: "Sign in to view status" }).click();
    await expect(bob.getByText("Received", { exact: true })).toBeVisible();
    const scoped = await bob.request.get(
      "/api/tracking?reference=" + a.reference,
    );
    expect(await scoped.json()).toMatchObject({ id: b.reference });
    expect(
      (
        await bob.request.post("/api/tracking/signin", {
          headers: { Origin: origin },
          data: { reference: a.reference, token: new URL(a.url).hash.slice(1) },
        })
      ).status(),
    ).toBe(401);
    await item.getByLabel("Enquiry status").selectOption("In progress");
    await expect(item.locator("summary")).toContainText("In progress");
    await alice.getByRole("button", { name: "Refresh status" }).click();
    await expect(alice.getByText("In progress", { exact: true })).toBeVisible();
    await alice.getByRole("button", { name: "Sign out" }).click();
    await expect(alice.getByRole("status")).toHaveText("Signed out.");
    expect((await alice.request.get("/api/tracking")).status()).toBe(401);
    await sql`UPDATE site_tracking_access SET issued_at=now()-interval '1 day' WHERE enquiry_id=${a.reference}`;
    await alice.getByLabel("Email address").fill(a.email);
    await alice
      .getByRole("button", { name: "Email me a sign-in link" })
      .click();
    await expect(alice.getByRole("status")).toContainText(
      "If the details match",
    );
    const renewed = async () =>
      (
        await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${a.email} AND subject='Sign in to track your enquiry' ORDER BY id DESC LIMIT 1`
      )[0]?.url;
    await expect.poll(renewed).not.toBe(a.url);
    await alice.goto(await renewed());
    await alice.getByRole("button", { name: "Sign in to view status" }).click();
    await expect(alice.getByText("In progress", { exact: true })).toBeVisible();
  } finally {
    await first.close();
    await second.close();
    for (const id of ids) {
      await sql`DELETE FROM customer_inquiries WHERE id=${id}`;
      await sql`DELETE FROM auth_mail_outbox WHERE subject='Sign in to track your enquiry' AND recipient=(SELECT payload->>'email' FROM site_enquiries WHERE id=${id})`;
      await sql`DELETE FROM site_notifications WHERE enquiry_id=${id}`;
      await sql`DELETE FROM site_enquiries WHERE id=${id}`;
    }
  }
}
