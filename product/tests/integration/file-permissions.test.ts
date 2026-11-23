import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";
import app from "../../server/index";

it("separates staff file metadata, downloads, restoration, review and deletion", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated migrated PostgreSQL required.");
  const sql = postgres(process.env.DATABASE_URL);
  const suffix = randomUUID();
  const fileId = randomUUID();
  const emails = [
    `file-grants-owner-${suffix}@example.com`,
    `file-grants-staff-${suffix}@example.com`,
  ];
  const base = "http://localhost:8787";
  const objects = new Map<string, ArrayBuffer>();
  const metadata = new Map<string, Record<string, string>>();
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_BASE_URL: base,
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
    FILES: {
      async put(
        key: string,
        bytes: ArrayBuffer,
        options?: { onlyIf: Headers; customMetadata: Record<string, string> },
      ) {
        if (options?.onlyIf.get("If-None-Match") === "*" && objects.has(key))
          return null;
        if (options) metadata.set(key, options.customMetadata);
        else metadata.delete(key);
        objects.set(key, bytes.slice(0));
        return { size: bytes.byteLength };
      },
      async get(key: string) {
        const bytes = objects.get(key);
        return bytes
          ? {
              size: bytes.byteLength,
              customMetadata: metadata.get(key),
              arrayBuffer: async () => bytes.slice(0),
            }
          : null;
      },
      async list({ limit, cursor }: { limit: number; cursor?: string }) {
        const start = Number(cursor ?? 0);
        const keys = [...objects.keys()].sort();
        return {
          objects: keys
            .slice(start, start + limit)
            .map((key) => ({ key, size: objects.get(key)!.byteLength })),
          truncated: keys.length > start + limit,
          cursor:
            keys.length > start + limit ? String(start + limit) : undefined,
        };
      },
      async delete(key: string) {
        objects.delete(key);
      },
    },
  };
  let ip = 0;
  const request = (
    path: string,
    cookie = "",
    method = "GET",
    body?: BodyInit,
    headers: Record<string, string> = {},
  ) =>
    app.request(
      new URL(path, base).href,
      {
        method,
        headers: {
          Origin: base,
          Cookie: cookie,
          "cf-connecting-ip": `2001:db8:${suffix.slice(0, 4)}:${suffix.slice(4, 8)}::${++ip}`,
          ...headers,
        },
        body,
      },
      env,
    );
  async function register(email: string) {
    const data = {
      email,
      password: "A strong file fixture password 123!",
      name: "File fixture",
    };
    expect(
      (
        await request(
          "/api/auth/sign-up/email",
          "",
          "POST",
          JSON.stringify(data),
          { "Content-Type": "application/json" },
        )
      ).status,
    ).toBe(200);
    const [mail] =
      await sql`SELECT url FROM auth_mail_outbox WHERE recipient = ${email} ORDER BY id DESC LIMIT 1`;
    expect((await request(mail.url)).status).toBe(302);
    const login = await request(
      "/api/auth/sign-in/email",
      "",
      "POST",
      JSON.stringify(data),
      { "Content-Type": "application/json" },
    );
    expect(login.status).toBe(200);
    const [user] = await sql`SELECT id FROM "user" WHERE email = ${email}`;
    return {
      id: user.id,
      cookie: login.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; "),
    };
  }
  try {
    const owner = await register(emails[0]);
    const staff = await register(emails[1]);
    await sql`INSERT INTO team_members (user_id, role) VALUES (${owner.id}, 'owner'), (${staff.id}, 'staff')`;
    let version = 1;
    const grant = async (permissions: string[]) => {
      expect(
        (
          await request(
            `/api/team/members/${staff.id}`,
            owner.cookie,
            "PUT",
            JSON.stringify({ version: version++, permissions }),
            { "Content-Type": "application/json" },
          )
        ).status,
      ).toBe(200);
    };
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2]);
    const upload = (cookie: string, restore = false) =>
      request(
        `/api/files/${fileId}${restore ? "/restore" : ""}`,
        cookie,
        "PUT",
        bytes,
        { "Content-Type": "image/png", "X-File-Name": "fixture.png" },
      );
    expect((await upload(owner.cookie)).status).toBe(200);
    await grant(["files:read"]);
    expect((await request("/api/files", staff.cookie)).status).toBe(200);
    for (const path of [
      `/api/files/${fileId}`,
      "/api/files/integrity",
      "/api/files/objects",
    ])
      expect((await request(path, staff.cookie)).status).toBe(403);
    expect((await upload(staff.cookie)).status).toBe(403);
    expect((await upload(staff.cookie, true)).status).toBe(403);
    expect(
      (await request(`/api/files/${fileId}`, staff.cookie, "DELETE")).status,
    ).toBe(403);
    await grant(["files:read", "files:download"]);
    expect(
      new Uint8Array(
        await (
          await request(`/api/files/${fileId}`, staff.cookie)
        ).arrayBuffer(),
      ),
    ).toEqual(bytes);
    expect((await upload(staff.cookie)).status).toBe(403);
    await grant(["files:read", "files:review"]);
    expect((await request("/api/files/integrity", staff.cookie)).status).toBe(
      200,
    );
    expect((await request("/api/files/objects", staff.cookie)).status).toBe(
      200,
    );
    expect((await request(`/api/files/${fileId}`, staff.cookie)).status).toBe(
      403,
    );
    expect((await upload(staff.cookie, true)).status).toBe(403);
    await grant(["files:read", "files:write"]);
    await sql`DELETE FROM managed_files WHERE id = ${fileId}`;
    expect((await upload(staff.cookie)).status).toBe(409);
    expect(objects.get(fileId)).toEqual(bytes.buffer);
    expect((await upload(owner.cookie)).status).toBe(200);
    objects.delete(fileId);
    expect((await upload(staff.cookie, true)).status).toBe(200);
    expect(objects.has(fileId)).toBe(true);
    expect((await request(`/api/files/${fileId}`, staff.cookie)).status).toBe(
      403,
    );
    expect(
      (await request(`/api/files/${fileId}`, staff.cookie, "DELETE")).status,
    ).toBe(403);
    expect(
      (
        await sql`SELECT actor_id FROM admin_audit_events WHERE target_id = ${fileId} AND action = 'file.restored'`
      )[0].actor_id,
    ).toBe(staff.id);
    await grant(["files:read", "files:delete"]);
    expect(
      (await request(`/api/files/${fileId}`, staff.cookie, "DELETE")).status,
    ).toBe(204);
    expect(objects.has(fileId)).toBe(false);
    expect(
      (
        await sql`SELECT actor_id FROM admin_audit_events WHERE target_id = ${fileId} AND action = 'file.deleted'`
      )[0].actor_id,
    ).toBe(staff.id);
    await grant([]);
    expect((await request("/api/files", staff.cookie)).status).toBe(403);
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${staff.id}, 'files:write')`;
    expect((await upload(staff.cookie)).status).toBe(403);
  } finally {
    await sql`DELETE FROM managed_files WHERE id = ${fileId}`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email = ANY(${emails}))`;
    await sql`DELETE FROM "user" WHERE email = ANY(${emails})`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient = ANY(${emails})`;
    await sql.end();
  }
}, 30000);
