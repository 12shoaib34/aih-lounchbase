import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, it } from "vitest";
import app from "../../server/index";

it("repairs exact upload retries after storage failures and rejects damaged downloads", async () => {
  if (!process.env.DATABASE_URL)
    throw new Error("Dedicated migrated PostgreSQL required.");
  const sql = postgres(process.env.DATABASE_URL);
  const suffix = randomUUID();
  const fileId = randomUUID();
  const quotaIds = [randomUUID(), randomUUID(), randomUUID()];
  const scanIds = Array.from({ length: 6 }, () => randomUUID());
  const emails = [
    `files-owner-${suffix}@example.com`,
    `files-customer-${suffix}@example.com`,
  ];
  const base = "http://localhost:8787";
  const objects = new Map<string, ArrayBuffer>();
  const metadata = new Map<string, Record<string, string>>();
  let investigatedId: string | undefined;
  let failHead = false;
  let heads = 0;
  let objectVersion: string | undefined = "fixture-version";
  let reportedSize: number | undefined;
  let bodies = 0;
  let failGet = false;
  let failPut = false;
  let failList = false;
  let failDelete = false;
  let writes = 0;
  let deletes = 0;
  const env = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_BASE_URL: base,
    AUTH_ALLOW_SIGNUP: "true",
    AUTH_EMAIL_MODE: "outbox",
    FILES_MAX_TOTAL_BYTES: undefined as string | undefined,
    FILES_MAX_COUNT: undefined as string | undefined,
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
        writes++;
        objects.set(key, bytes.slice(0));
        if (failPut) throw new Error("Simulated loss after object write");
        return { size: bytes.byteLength };
      },
      async head(key: string) {
        heads++;
        if (failHead) throw new Error("Private storage error sentinel");
        const bytes = objects.get(key);
        return bytes ? { size: bytes.byteLength } : null;
      },
      async get(key: string) {
        if (failGet) throw new Error("Storage unavailable");
        const bytes = objects.get(key);
        return bytes
          ? {
              size: reportedSize ?? bytes.byteLength,
              customMetadata: metadata.get(key),
              version: objectVersion,
              arrayBuffer: async () => {
                bodies++;
                return bytes.slice(0);
              },
            }
          : null;
      },
      async list({ limit, cursor }: { limit: number; cursor?: string }) {
        if (failList) throw new Error("Synthetic listing failure");
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
        deletes++;
        objects.delete(key);
        if (failDelete) throw new Error("Simulated loss after object deletion");
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
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
  try {
    const owner = await register(emails[0]);
    const customer = await register(emails[1]);
    await sql`INSERT INTO team_members (user_id, role) VALUES (${owner.id}, 'owner')`;
    const upload = (
      cookie = owner.cookie,
      payload = bytes,
      name = "fixture.png",
    ) =>
      request(`/api/files/${fileId}`, cookie, "PUT", payload, {
        "Content-Type": "image/png",
        "X-File-Name": name,
      });
    const restore = (payload = bytes, cookie = owner.cookie) =>
      request(`/api/files/${fileId}/restore`, cookie, "PUT", payload, {
        "Content-Type": "image/png",
        "X-File-Name": "fixture.png",
      });
    const scanState = async () => {
      const data = await (
        await request("/api/files/integrity", owner.cookie)
      ).json();
      return data.items.find((row: { id: string }) => row.id === fileId)?.state;
    };
    expect((await request("/api/files/integrity")).status).toBe(401);
    expect((await request("/api/files/objects", customer.cookie)).status).toBe(
      403,
    );
    expect((await restore(bytes, customer.cookie)).status).toBe(403);
    expect((await restore()).status).toBe(404);
    expect((await upload("")).status).toBe(401);
    expect((await upload(customer.cookie)).status).toBe(403);
    expect(writes).toBe(0);
    failPut = true;
    expect((await upload()).status).toBe(500);
    expect(objects.has(fileId)).toBe(true);
    expect(
      await sql`SELECT id FROM managed_files WHERE id = ${fileId}`,
    ).toHaveLength(0);
    // A failed upload can leave bytes without metadata. Ordinary deletion
    // must preserve them, even for an owner with file-delete permission.
    const orphanDelete = await request(
      `/api/files/${fileId}`,
      owner.cookie,
      "DELETE",
    );
    expect(orphanDelete.status).toBe(204);
    expect(deletes).toBe(0);
    expect(objects.get(fileId)).toEqual(bytes.buffer);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE target_id = ${fileId}`,
    ).toHaveLength(0);
    failPut = false;
    const conflicting = bytes.slice();
    conflicting[10]++;
    expect((await upload(owner.cookie, conflicting)).status).toBe(409);
    expect((await upload(owner.cookie, bytes, "renamed.png")).status).toBe(409);
    const identity = metadata.get(fileId)!;
    metadata.delete(fileId); // Older objects carry no retry identity.
    expect((await upload()).status).toBe(409);
    metadata.set(fileId, identity);
    objects.set(fileId, conflicting.buffer); // Check actual bytes even when identity matches.
    expect((await upload()).status).toBe(409);
    expect(objects.get(fileId)).toEqual(conflicting.buffer);
    objects.set(fileId, bytes.buffer);
    failGet = true;
    expect((await upload()).status).toBe(500);
    failGet = false;
    expect(
      await sql`SELECT id FROM managed_files WHERE id = ${fileId}`,
    ).toHaveLength(0);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE target_id = ${fileId}`,
    ).toHaveLength(0);
    expect((await upload()).status).toBe(200);
    expect(writes).toBe(1);
    expect(
      await sql`SELECT id FROM admin_audit_events WHERE target_id = ${fileId} AND action = 'file.created'`,
    ).toHaveLength(1);
    expect(await scanState()).toBe("healthy");
    failGet = true;
    expect(await scanState()).toBe("unavailable");
    failGet = false;
    const originalWrites = writes;
    expect((await upload()).status).toBe(200);
    expect(writes).toBe(originalWrites); // Healthy retries do not rewrite the object.
    const download = () => request(`/api/files/${fileId}`, owner.cookie);
    expect(new Uint8Array(await (await download()).arrayBuffer())).toEqual(
      bytes,
    );
    failDelete = true;
    expect(
      (await request(`/api/files/${fileId}`, owner.cookie, "DELETE")).status,
    ).toBe(500);
    expect(
      await sql`SELECT id FROM managed_files WHERE id = ${fileId}`,
    ).toHaveLength(1);
    expect((await download()).status).toBe(503);
    expect(await scanState()).toBe("missing");
    expect((await upload(owner.cookie, bytes, "different.png")).status).toBe(
      409,
    );
    expect(objects.has(fileId)).toBe(false);
    expect((await upload()).status).toBe(200);
    expect(new Uint8Array(await (await download()).arrayBuffer())).toEqual(
      bytes,
    );
    expect((await restore()).status).toBe(200);
    const damaged = bytes.slice();
    damaged[10] = 99;
    objects.set(fileId, damaged.buffer);
    expect((await download()).status).toBe(503);
    expect(await scanState()).toBe("damaged");
    expect((await restore(damaged)).status).toBe(409);
    expect((await restore()).status).toBe(200);
    objects.set(fileId, damaged.buffer);
    expect((await upload(owner.cookie, damaged)).status).toBe(409);
    expect((await upload()).status).toBe(200);
    expect(new Uint8Array(await (await download()).arrayBuffer())).toEqual(
      bytes,
    );
    expect(
      (await request(`/api/files/${fileId}`, customer.cookie)).status,
    ).toBe(403);
    objects.set(fileId, new Uint8Array([0]).buffer);
    expect(await scanState()).toBe("damaged");
    expect((await download()).status).toBe(503);
    expect((await restore()).status).toBe(200);
    expect(new Uint8Array(await (await download()).arrayBuffer())).toEqual(
      bytes,
    );
    const unsupportedList = await app.request(
      `${base}/api/files/objects`,
      { headers: { Cookie: owner.cookie } },
      { ...env, FILES: { ...env.FILES, list: undefined } },
    );
    expect(unsupportedList.status).toBe(503);
    // Both scans are read-only, bounded and cover all pages.
    const writesBeforeScan = writes;
    for (const id of scanIds)
      await sql`INSERT INTO managed_files (id, name, type, size, checksum) VALUES (${id}, 'Scan fixture', 'image/png', 11, 'missing-fixture')`;
    const seen: string[] = [];
    let after: string | null = null;
    do {
      const response = await request(
        `/api/files/integrity${after ? `?after=${after}` : ""}`,
        owner.cookie,
      );
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.items.length).toBeLessThanOrEqual(5);
      seen.push(...data.items.map((row: { id: string }) => row.id));
      after = data.next;
    } while (after);
    expect(new Set(seen).size).toBe(seen.length);
    for (const id of scanIds) expect(seen).toContain(id);
    objects.set("other-feature/file.txt", bytes.buffer);
    for (let i = 0; i < 101; i++) objects.set(randomUUID(), bytes.buffer);
    const first = await (
      await request("/api/files/objects", owner.cookie)
    ).json();
    expect(first.items).toHaveLength(100);
    expect(first.next).not.toBeNull();
    const second = await (
      await request(`/api/files/objects?cursor=${first.next}`, owner.cookie)
    ).json();
    expect(second.next).toBeNull();
    const all = [...first.items, ...second.items];
    expect(all.find((row: { key: string }) => row.key === fileId).state).toBe(
      "referenced",
    );
    expect(
      all.filter((row: { state: string }) => row.state === "unreferenced"),
    ).toHaveLength(101);
    expect(
      all.find((row: { key: string }) => row.key === "other-feature/file.txt")
        .state,
    ).toBe("unrecognized");
    expect(writes).toBe(writesBeforeScan);
    expect(objects.size).toBe(103);
    expect(
      (await request("/api/files/integrity?after=invalid", owner.cookie))
        .status,
    ).toBe(400);
    expect(
      (await request("/api/files/objects?cursor=", owner.cookie)).status,
    ).toBe(400);
    // GET observations do not create history. POST captures server observations.
    expect(
      await sql`SELECT id FROM file_scan_history WHERE actor_id = ${owner.id}`,
    ).toHaveLength(0);
    expect((await request("/api/files/history")).status).toBe(401);
    expect((await request("/api/files/history", customer.cookie)).status).toBe(
      403,
    );
    expect(
      (await request("/api/files/objects", customer.cookie, "POST")).status,
    ).toBe(403);
    expect(
      (
        await request("/api/files/objects", owner.cookie, "POST", undefined, {
          Origin: "https://other.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (await request("/api/files/objects", owner.cookie, "POST")).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/api/files/objects?cursor=${first.next}`,
          owner.cookie,
          "POST",
        )
      ).status,
    ).toBe(200);
    let history = await (
      await request("/api/files/history", owner.cookie)
    ).json();
    const saved = history.items.filter(
      (row: { actorId: string }) => row.actorId === owner.id,
    );
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      kind: "objects",
      continued: true,
      hasMore: false,
    });
    expect(saved[1]).toMatchObject({
      kind: "objects",
      continued: false,
      hasMore: true,
    });
    expect(
      saved.flatMap((row: { items: unknown[] }) => row.items),
    ).toContainEqual({
      reference: null,
      size: bytes.length,
      state: "unrecognized",
    });
    expect(JSON.stringify(saved)).not.toContain("other-feature");
    expect(JSON.stringify(saved)).not.toContain("fixture.png");
    const candidateScan = saved.find((row: { items: { state: string }[] }) =>
      row.items.some((item) => item.state === "unreferenced"),
    );
    investigatedId = candidateScan.items.find(
      (item: { state: string }) => item.state === "unreferenced",
    ).reference;
    const path = `/api/files/history/${candidateScan.id}/objects/${investigatedId}/check`;
    const investigate = (cookie = owner.cookie) =>
      request(path, cookie, "POST");
    expect((await investigate("")).status).toBe(401);
    expect((await investigate(customer.cookie)).status).toBe(403);
    expect(
      (
        await request(path, owner.cookie, "POST", undefined, {
          Origin: "https://other.example",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          `/api/files/history/${candidateScan.id}/objects/${fileId}/check`,
          owner.cookie,
          "POST",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          `/api/files/history/99999999999999999999/objects/${investigatedId}/check`,
          owner.cookie,
          "POST",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          `/api/files/history/invalid/objects/${investigatedId}/check`,
          owner.cookie,
          "POST",
        )
      ).status,
    ).toBe(400);
    expect(heads).toBe(0);
    const beforeInvestigation = JSON.stringify(
      await (await request("/api/files/history", owner.cookie)).json(),
    );
    expect(await (await investigate()).json()).toMatchObject({
      reference: investigatedId,
      state: "unreferenced",
      size: bytes.length,
    });
    const preserve = (cookie = owner.cookie) =>
      request(path.replace(/check$/, "preserve"), cookie, "POST");
    const beforeExportBodies = bodies;
    expect((await preserve("")).status).toBe(401);
    expect((await preserve(customer.cookie)).status).toBe(403);
    expect(bodies).toBe(beforeExportBodies);
    const exported = await preserve();
    expect(exported.status).toBe(200);
    expect(exported.headers.get("cache-control")).toBe("no-store");
    const bundle = await exported.json();
    expect(bundle).toMatchObject({
      reference: investigatedId,
      storageVersion: "fixture-version",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect(Buffer.from(bundle.bytes, "base64")).toEqual(Buffer.from(bytes));
    expect(objects.get(investigatedId!)).toEqual(bytes.buffer);
    objectVersion = undefined;
    const bodiesBeforeInvalid = bodies;
    expect((await preserve()).status).toBe(503);
    objectVersion = "fixture-version";
    reportedSize = 5242881;
    expect((await preserve()).status).toBe(503);
    expect(bodies).toBe(bodiesBeforeInvalid);
    reportedSize = bytes.length + 1;
    expect((await preserve()).status).toBe(503);
    reportedSize = undefined;
    failGet = true;
    expect((await preserve()).status).toBe(500);
    failGet = false;
    failHead = true;
    const unavailable = await (await investigate()).json();
    expect(unavailable).toMatchObject({ state: "unavailable", size: null });
    expect(JSON.stringify(unavailable)).not.toContain("sentinel");
    failHead = false;
    objects.delete(investigatedId!);
    expect((await preserve()).status).toBe(404);
    expect(await (await investigate()).json()).toMatchObject({
      state: "absent",
      size: null,
    });
    objects.set(investigatedId!, bytes.buffer);
    const unsupportedHead = await app.request(
      new URL(path, base).href,
      { method: "POST", headers: { Origin: base, Cookie: owner.cookie } },
      { ...env, FILES: { ...env.FILES, head: undefined } },
    );
    expect(unsupportedHead.status).toBe(503);
    // A check waits for an application upload's metadata transaction to finish.
    let inFlight: Promise<Response> | undefined;
    const headsBeforeWait = heads;
    await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(8124, 1)`;
      inFlight = Promise.resolve(investigate());
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const [locks] =
          await tx`SELECT EXISTS (SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 8124 AND objid = 1 AND NOT granted) AS waiting`;
        if (locks.waiting) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      expect(heads).toBe(headsBeforeWait);
      await tx`INSERT INTO managed_files (id, name, type, size, checksum) VALUES (${investigatedId!}, 'Investigation fixture', 'image/png', 11, 'fixture')`;
    });
    expect(await (await inFlight!).json()).toMatchObject({
      state: "referenced",
      size: null,
    });
    expect(heads).toBe(headsBeforeWait);
    expect((await preserve()).status).toBe(409);
    await sql`DELETE FROM managed_files WHERE id = ${investigatedId!}`;
    expect(
      JSON.stringify(
        await (await request("/api/files/history", owner.cookie)).json(),
      ),
    ).toBe(beforeInvestigation);
    failGet = true;
    expect(
      (await request("/api/files/integrity", owner.cookie, "POST")).status,
    ).toBe(200);
    failGet = false;
    history = await (await request("/api/files/history", owner.cookie)).json();
    expect(
      history.items[0].items.every(
        (item: { state: string }) => item.state === "unavailable",
      ),
    ).toBe(true);
    const savedId = history.items[0].id;
    await request("/api/files/integrity", owner.cookie);
    expect(
      (await (await request("/api/files/history", owner.cookie)).json())
        .items[0].id,
    ).toBe(savedId);
    failList = true;
    expect(
      (await request("/api/files/objects", owner.cookie, "POST")).status,
    ).toBe(500);
    failList = false;
    expect(
      (await (await request("/api/files/history", owner.cookie)).json())
        .items[0].id,
    ).toBe(savedId);
    // A failed persistence transaction cannot be presented as a saved report.
    await sql`ALTER TABLE file_scan_history ADD CONSTRAINT test_reject_scan CHECK (false) NOT VALID`;
    try {
      expect(
        (await request("/api/files/integrity", owner.cookie, "POST")).status,
      ).toBe(500);
      expect(
        (await (await request("/api/files/history", owner.cookie)).json())
          .items[0].id,
      ).toBe(savedId);
    } finally {
      await sql`ALTER TABLE file_scan_history DROP CONSTRAINT test_reject_scan`;
    }
    // Permission changes apply to the same session, including historical results.
    await sql`INSERT INTO team_members (user_id, role) VALUES (${customer.id}, 'staff')`;
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${customer.id}, 'files:read')`;
    expect((await request("/api/files/history", customer.cookie)).status).toBe(
      403,
    );
    await sql`INSERT INTO user_permissions (user_id, permission) VALUES (${customer.id}, 'files:review')`;
    expect((await preserve(customer.cookie)).status).toBe(403);
    expect(
      (await (await request("/api/files/history", customer.cookie)).json())
        .canPreserve,
    ).toBe(false);

    expect((await request("/api/files/history", customer.cookie)).status).toBe(
      200,
    );
    expect(
      (await request("/api/files/integrity", customer.cookie, "POST")).status,
    ).toBe(200);
    await sql`DELETE FROM user_permissions WHERE user_id = ${customer.id}`;
    expect((await request("/api/files/history", customer.cookie)).status).toBe(
      403,
    );
    await sql`DELETE FROM team_members WHERE user_id = ${customer.id}`;
    expect((await investigate(customer.cookie)).status).toBe(403);
    // Concurrent saves retain a bounded recent window under one history lock.
    await sql`INSERT INTO file_scan_history (actor_id, kind, started_at, finished_at, continued, has_more, items)
      SELECT ${owner.id}, 'objects', now(), now(), false, false, '[]'::jsonb FROM generate_series(1, 110)`;
    const saves = await Promise.all([
      request("/api/files/objects", owner.cookie, "POST"),
      request("/api/files/integrity", owner.cookie, "POST"),
    ]);
    expect(saves.map((response) => response.status)).toEqual([200, 200]);
    history = await (await request("/api/files/history", owner.cookie)).json();
    expect(history.items).toHaveLength(50);
    const numericIds = history.items.map((row: { id: string }) =>
      BigInt(row.id),
    );
    expect(numericIds).toEqual(
      [...numericIds].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0)),
    );
    const latest =
      await sql`SELECT id::text FROM file_scan_history ORDER BY file_scan_history.id DESC LIMIT 1`;
    expect(history.items[0].id).toBe(latest[0].id);
    expect((await investigate()).status).toBe(404);
    expect((await preserve()).status).toBe(404);
    expect(
      history.items.some((row: { id: string }) => row.id === savedId),
    ).toBe(false);
    expect(
      (await sql`SELECT count(*)::int AS count FROM file_scan_history`)[0]
        .count,
    ).toBe(50);
    expect(writes).toBe(writesBeforeScan);
    failDelete = false;
    expect(
      (await request(`/api/files/${fileId}`, owner.cookie, "DELETE")).status,
    ).toBe(204);
    expect((await download()).status).toBe(404);
    expect((await restore()).status).toBe(404);
    expect(objects.has(fileId)).toBe(false);
    const deletesAfterRemoval = deletes;
    // A later object at the old key is not covered by the deleted record.
    objects.set(fileId, bytes.buffer);
    expect(
      (await request(`/api/files/${fileId}`, owner.cookie, "DELETE")).status,
    ).toBe(204);
    expect(deletes).toBe(deletesAfterRemoval);
    expect(objects.get(fileId)).toEqual(bytes.buffer);
    objects.delete(fileId);
    expect(
      (await request(`/api/files/${randomUUID()}`, owner.cookie, "DELETE"))
        .status,
    ).toBe(204);
    expect(deletes).toBe(deletesAfterRemoval);
    const events =
      await sql`SELECT * FROM admin_audit_events WHERE target_id = ${fileId} ORDER BY id`;
    expect(events.map((event) => event.action)).toEqual([
      "file.created",
      "file.restored",
      "file.restored",
      "file.restored",
      "file.restored",
      "file.deleted",
    ]);
    expect(
      events.every(
        (event) => event.actor_id === owner.id && event.target_type === "file",
      ),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain(".png");
    const [baseline] =
      await sql`SELECT count(*)::int AS count, COALESCE(sum(size), 0)::int AS bytes FROM managed_files`;
    env.FILES_MAX_COUNT = String(baseline.count + 1);
    env.FILES_MAX_TOTAL_BYTES = String(baseline.bytes + bytes.byteLength);
    const quotaUpload = (id: string, restoreOnly = false) =>
      request(
        `/api/files/${id}${restoreOnly ? "/restore" : ""}`,
        owner.cookie,
        "PUT",
        bytes,
        { "Content-Type": "image/png", "X-File-Name": "quota.png" },
      );
    const beforeWrites = writes;
    const concurrent = await Promise.all(
      quotaIds.slice(0, 2).map((id) => quotaUpload(id)),
    );
    expect(concurrent.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect(writes).toBe(beforeWrites + 1);
    const winner = quotaIds[concurrent[0].status === 200 ? 0 : 1];
    const loser = quotaIds[concurrent[0].status === 200 ? 1 : 0];
    const usage = await (await request("/api/files", owner.cookie)).json();
    expect(usage.storage).toMatchObject({
      usedBytes: baseline.bytes + bytes.byteLength,
      usedCount: baseline.count + 1,
      maxCount: baseline.count + 1,
    });
    env.FILES_MAX_TOTAL_BYTES = "1";
    env.FILES_MAX_COUNT = "1";
    expect((await quotaUpload(loser)).status).toBe(409);
    expect((await quotaUpload(winner)).status).toBe(200);
    objects.delete(winner);
    expect((await quotaUpload(winner, true)).status).toBe(200);
    expect(objects.get(winner)?.byteLength).toBe(bytes.byteLength);
    env.FILES_MAX_TOTAL_BYTES = String(baseline.bytes + bytes.byteLength);
    env.FILES_MAX_COUNT = String(baseline.count + 1);
    expect(
      (await request(`/api/files/${winner}`, owner.cookie, "DELETE")).status,
    ).toBe(204);
    expect((await quotaUpload(loser)).status).toBe(200);
    expect(
      (await request(`/api/files/${loser}`, owner.cookie, "DELETE")).status,
    ).toBe(204);
    env.FILES_MAX_COUNT = undefined;
    env.FILES_MAX_TOTAL_BYTES = String(baseline.bytes + bytes.byteLength - 1);
    const beforeDenied = writes;
    expect((await quotaUpload(quotaIds[2])).status).toBe(409);
    expect(writes).toBe(beforeDenied);
    env.FILES_MAX_TOTAL_BYTES = "invalid";
    expect((await quotaUpload(quotaIds[2])).status).toBe(503);
    expect(writes).toBe(beforeDenied);
  } finally {
    if (investigatedId)
      await sql`DELETE FROM managed_files WHERE id = ${investigatedId}`;
    await sql`DELETE FROM file_scan_history WHERE actor_id IN (SELECT id FROM "user" WHERE email IN (${emails[0]}, ${emails[1]}))`;
    await sql`DELETE FROM managed_files WHERE id = ${fileId} OR id = ANY(${[...scanIds, ...quotaIds]}::uuid[])`;
    await sql`DELETE FROM team_members WHERE user_id IN (SELECT id FROM "user" WHERE email IN (${emails[0]}, ${emails[1]}))`;
    await sql`DELETE FROM "user" WHERE email IN (${emails[0]}, ${emails[1]})`;
    await sql`DELETE FROM auth_mail_outbox WHERE recipient IN (${emails[0]}, ${emails[1]})`;
    await sql.end();
  }
}, 30000);
