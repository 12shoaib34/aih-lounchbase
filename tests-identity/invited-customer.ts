import { createOTP } from "@better-auth/utils/otp";
import { base32 } from "@better-auth/utils/base32";
import { execFileSync } from "node:child_process";
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";

export async function checkInvitation(
  browser: Browser,
  owner: Page,
  sql: postgres.Sql,
  origin: string,
) {
  const email = randomUUID() + "@example.invalid";
  const password = "Local fixture passphrase only 109!";
  const headers = { Origin: origin };
  const context = await browser.newContext({ baseURL: origin });
  const guest = await context.newPage();
  try {
    expect((await guest.request.get("/api/records")).status()).toBe(401);
    expect(
      (
        await guest.request.post("/api/auth/sign-up/email", {
          headers,
          data: {
            email,
            password,
            name: "Invited fixture",
            callbackURL: origin + "/app/account",
          },
        })
      ).status(),
    ).toBe(200);
    const [verification] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${email} ORDER BY id DESC LIMIT 1`;
    await guest.goto(verification.url);
    await expect(guest).toHaveURL(origin + "/app/account");
    await guest.getByRole("button", { name: "Forgot password?" }).click();
    await guest.getByLabel("Email address").fill(email);
    await guest.getByRole("button", { name: "Send recovery email" }).click();
    await expect(guest.getByRole("status")).toContainText("recovery email");
    const [reset] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${email} ORDER BY id DESC LIMIT 1`;
    await guest.goto(reset.url);
    await expect(guest).toHaveURL(/\/app\/account\?token=/);
    const newPassword = password + "2";
    await guest.getByLabel("New password").fill(newPassword);
    await guest.getByRole("button", { name: "Update password" }).click();
    await guest.getByLabel("Email address").fill(email);
    await guest.getByLabel("Password", { exact: true }).fill(newPassword);
    await guest.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      guest.getByRole("heading", { name: "Profile", exact: true }),
    ).toBeVisible();
    await guest.getByLabel("Display name").fill("Private fixture profile");
    await guest.getByRole("button", { name: "Save changes" }).click();
    await expect(guest.getByRole("status")).toContainText("saved");
    await guest.goto("/app");
    await expect(guest).toHaveURL(/\/app\/workspace$/);
    expect((await guest.request.get("/api/team")).status()).toBe(403);
    const id = randomUUID();
    expect(
      (
        await owner.request.post("/api/records", {
          headers,
          data: { id, title: "Owner record", status: "active" },
        })
      ).status(),
    ).toBe(201);
    expect((await guest.request.get("/api/records/" + id)).status()).toBe(404);
    expect(
      (
        await owner.request.post("/api/team/invitations", {
          headers,
          data: { email, permissions: [] },
        })
      ).status(),
    ).toBe(201);
    const [invite] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient=${email} ORDER BY id DESC LIMIT 1`;
    expect(new URL(invite.url).pathname).toBe("/app/invite");
    await guest.goto(invite.url);
    const accepted = guest.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/team/accept",
    );
    await guest.getByRole("button", { name: "Accept invitation" }).click();
    const acceptance = await accepted;
    expect(acceptance.status(), await acceptance.text()).toBe(200);
    await expect(
      guest.getByRole("heading", { name: "You joined the team" }),
    ).toBeVisible();
    await expect(guest).toHaveURL(origin + "/app/invite");
    expect(
      (
        await guest.request.post("/api/team/accept", {
          headers,
          data: { token: new URL(invite.url).hash.slice(1) },
        })
      ).status(),
    ).toBe(409);
    await guest.goto("/app");
    await expect(guest).toHaveURL(/\/app\/account\/two-factor$/);
    expect((await guest.request.get("/api/team")).status()).toBe(403);
    const [staff] =
      await sql`SELECT role FROM team_members m JOIN "user" u ON m.user_id=u.id WHERE u.email=${email}`;
    expect(staff.role).toBe("staff");
    await guest.getByLabel("Current password").fill(newPassword);
    await guest.getByRole("button", { name: "Set up authenticator" }).click();
    const setup = await guest
      .getByLabel("Authenticator setup key")
      .textContent();
    await guest
      .getByLabel("Authenticator code", { exact: true })
      .fill(await createOTP(base32.decode(setup!)).totp());
    await guest.getByRole("button", { name: "Confirm authenticator" }).click();
    await expect(guest.getByRole("status")).toContainText("enabled");
    await guest.goto("/app");
    await expect(guest).toHaveURL(/\/app\/admin$/);
    await expect(guest.getByText("Signed in as staff.")).toBeVisible();
    expect((await guest.request.get("/api/team")).status()).toBe(403);
    await guest.screenshot({ path: "/tmp/aih-step5-staff.png" });
    const [user] = await sql`SELECT id FROM "user" WHERE email=${email}`;
    const recoveryArgs = [
      "scripts/recover-mfa.mjs",
      user.id,
      email,
      randomUUID(),
    ];
    const recover = (flags: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [...recoveryArgs, ...flags], {
          encoding: "utf8",
          env: {
            ...process.env,
            DATABASE_URL:
              "postgres://postgres:postgres@127.0.0.1:54441/identity_fixture",
          },
        }),
      );
    expect(recover([]).status).toBe("eligible");
    const flags = ["--apply", "--identity-verified", "--quiesced"];
    expect(recover(flags).status).toBe("recovery-required");
    expect(recover(flags).status).toBe("already-recorded");
    expect((await guest.request.get("/api/profile")).status()).toBe(401);
    await guest.goto("/app");
    await expect(
      guest.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
  } finally {
    await context.close();
    await sql`DELETE FROM "user" WHERE email=${email}`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient=${email}`;
  }
}
