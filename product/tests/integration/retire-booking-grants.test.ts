import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
import { expect, it } from "vitest";
import { auditPageSchema } from "../../shared/audit";
import { invitationInput } from "../../shared/team";

it("upgrades booking-era memberships and invites while preserving reservations and readable audit history", async () => {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const schema = "retirement_" + randomUUID().replaceAll("-", "");
  try {
    await sql.begin(async (tx) => {
      await tx`CREATE SCHEMA ${tx(schema)}`;
      await tx`SET LOCAL search_path TO ${tx(schema)}`;
      const directory = "database/migrations/";
      for (const file of (await readdir(directory))
        .sort()
        .filter((name) => name.endsWith(".sql") && name < "036")) {
        await tx.unsafe(await readFile(directory + file, "utf8"));
      }
      const member = randomUUID(),
        resource = randomUUID(),
        booking = randomUUID();
      await tx`INSERT INTO "user"(id,name,email,"emailVerified") VALUES(${member},'Reviewer','review@example.com',true)`;
      await tx`INSERT INTO team_members(user_id,role) VALUES(${member},'staff')`;
      await tx`INSERT INTO user_permissions VALUES(${member},'contacts:read'),(${member},'scheduling:read')`;
      const grants = ["contacts:read", "scheduling:read"];
      await tx`INSERT INTO team_invitations(id,email,token_hash,permissions,invited_by,expires_at) VALUES(${randomUUID()},'invite@example.com',${randomUUID()},${tx.json(grants)},${member},now()+interval '1 day')`;
      await tx`INSERT INTO scheduling_resources(id,data) VALUES(${resource},'{"name":"Desk"}')`;
      await tx`INSERT INTO bookings(id,resource_id,customer_id,starts_at,ends_at) VALUES(${booking},${resource},${member},now(),now()+interval '1 hour')`;
      await tx`INSERT INTO admin_audit_events(action,actor_type,actor_id,target_type,target_id,after_permissions) VALUES('member.permissions_changed','account',${member},'account',${member},${tx.json(grants)})`;
      await tx.unsafe(
        await readFile(directory + "036_retire_booking_grants.sql", "utf8"),
      );
      expect(await tx`SELECT permission FROM user_permissions`).toEqual([
        { permission: "contacts:read" },
      ]);
      expect(await tx`SELECT version FROM team_members`).toEqual([
        { version: 2 },
      ]);
      expect(await tx`SELECT permissions FROM team_invitations`).toEqual([
        { permissions: ["contacts:read"] },
      ]);
      expect(await tx`SELECT id,resource_id FROM bookings`).toEqual([
        { id: booking, resource_id: resource },
      ]);
      const [event] =
        await tx`SELECT after_permissions FROM admin_audit_events`;
      expect(
        auditPageSchema.shape.items.element.shape.afterPermissions.parse(
          event.after_permissions,
        ),
      ).toEqual(grants);
      expect(invitationInput.shape.permissions.safeParse(grants).success).toBe(
        false,
      );
      await tx`DROP SCHEMA ${tx(schema)} CASCADE`;
    });
  } finally {
    await sql.end();
  }
});
