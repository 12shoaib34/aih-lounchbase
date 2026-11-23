import {fixtureDatabase} from "../scripts/identity-endpoints.mjs";
import { checkInvitation } from "./invited-customer";
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import postgres from "postgres";

// Isolate this browser fixture from earlier journeys sharing localhost.
// Rate-limit enforcement remains enabled during the actual test.
test.beforeAll(async () => {
  const sql = postgres(
    fixtureDatabase,
  );
  try {
    await sql`DELETE FROM "rateLimit"`;
  } finally {
    await sql.end();
  }
});

test("authenticator enrollment and recovery-code sign-in work through Workers", async ({
  page,
  request,
  baseURL,
  browser,
}) => {
  const sql = postgres(
    fixtureDatabase,
  );
  const email = `browser-factor-${randomUUID()}@example.com`;
  const password = "A browser two-factor password 123!";
  try {
    const signup = await page.request.post("/api/auth/sign-up/email", {
      headers: { Origin: baseURL! },
      data: {
        email,
        password,
        name: "Two-factor browser",
        callbackURL: `${baseURL}/app/account`,
      },
    });
    expect(signup.status()).toBe(200);
    const policy = true;
    if (policy)
      await sql`INSERT INTO team_members (user_id, role) SELECT id, 'owner' FROM "user" WHERE email = ${email}`;
    const [mail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${email} ORDER BY id DESC LIMIT 1`;
    await page.goto(mail.url);
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Account shortcuts" })
      .getByRole("link", { name: "Two-factor authentication", exact: true })
      .click();
    if (policy) {
      await page.goto("/app/admin");
      await page
        .getByRole("link", {
          name: "Verify two-factor authentication",
        })
        .click();
    }
    expect(
      (
        await request.post("/api/auth/sign-in/email", {
          headers: { Origin: baseURL! },
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get("/api/profile")).status()).toBe(200);
    await page.getByLabel("Current password", { exact: true }).fill(password);
    await page
      .getByRole("button", { name: "Set up authenticator", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Connect your authenticator",
        exact: true,
      }),
    ).toBeFocused();
    const key = page.getByLabel("Authenticator setup key", { exact: true });
    await expect(key).toBeVisible();
    const code = await createOTP(
      base32.decode((await key.textContent())!),
    ).totp();
    const recoveryCode = (await page.locator("li code").first().textContent())!;
    const secondRecoveryCode = (await page
      .locator("li code")
      .nth(1)
      .textContent())!;
    const stepUpCode = (await page.locator("li code").nth(2).textContent())!;
    await page.getByLabel("Authenticator code", { exact: true }).fill(code);
    await page
      .getByRole("button", { name: "Confirm authenticator", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Two-factor authentication enabled.",
    );
    await expect(page.getByRole("status")).toBeFocused();
    expect((await request.get("/api/profile")).status()).toBe(401);
    expect(
      (
        await request.post("/api/auth/sign-in/email", {
          headers: { Origin: baseURL! },
          data: { email, password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.post("/api/auth/two-factor/verify-backup-code", {
          headers: { Origin: baseURL! },
          data: { code: secondRecoveryCode },
        })
      ).status(),
    ).toBe(200);
    expect((await request.get("/api/profile")).status()).toBe(200);
    await page
      .getByRole("button", { name: "I saved my recovery codes", exact: true })
      .click();
    if (policy) {
      expect((await page.request.get("/api/team")).status()).toBe(200);
      await checkInvitation(browser, page, sql, baseURL!);
      await sql`DELETE FROM session_mfa_proof WHERE session_id IN (SELECT id FROM "session" WHERE "userId" IN (SELECT id FROM "user" WHERE email = ${email}))`;
      await page.goto("/app/admin");
      await page
        .getByRole("link", {
          name: "Verify two-factor authentication",
        })
        .click();
      await page
        .getByRole("button", {
          name: "Use recovery code for this session",
          exact: true,
        })
        .click();
      await page
        .getByLabel("Recovery code for this session", { exact: true })
        .fill(stepUpCode);
      await page
        .getByRole("button", { name: "Verify this session", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText(
        "Code verified for this session",
      );
      await page
        .getByRole("link", { name: "Return to administration", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Administration", exact: true }),
      ).toBeVisible();
      await page.goto("/app/account/two-factor");
    }
    await page
      .getByRole("link", { name: "Back to my account", exact: true })
      .click();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByLabel("Email address", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Verify your sign-in", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Verify your sign-in", exact: true }),
    ).toBeFocused();
    expect((await page.request.get("/api/profile")).status()).toBe(401);
    await page
      .getByRole("button", { name: "Use recovery code", exact: true })
      .click();
    await page.getByLabel("Recovery code", { exact: true }).fill(recoveryCode);
    await page
      .getByRole("button", { name: "Verify sign-in", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Account shortcuts" })
      .getByRole("link", { name: "Two-factor authentication", exact: true })
      .click();
    await page.getByLabel("Current password", { exact: true }).fill(password);
    await page
      .getByRole("button", {
        name: "Disable two-factor authentication",
        exact: true,
      })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "Two-factor authentication disabled.",
    );
    expect((await request.get("/api/profile")).status()).toBe(401);
    expect((await page.request.get("/api/profile")).status()).toBe(200);
  } finally {
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email = ${email})`;
    await sql`DELETE FROM "user" WHERE email = ${email}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ${email}`;
    await sql.end();
  }
});
