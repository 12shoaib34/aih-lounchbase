import { Buffer } from "node:buffer";
import { preservationSchema } from "../shared/file-preservation";
import { filePolicy } from "./file-policy";
import { recordBusinessAudit } from "./audit";
import { Hono, type Context, type Handler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import {
  authenticate,
  requirePermission,
  ApiFault,
  type AppEnv,
} from "./access";
import {
  fileTypes,
  maxFileSize,
  type fileIntegritySchema,
} from "../shared/files";

async function digest(bytes: ArrayBuffer) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function retainScan(
  c: Context<AppEnv>,
  kind: "integrity" | "objects",
  startedAt: string,
  finishedAt: string,
  continued: boolean,
  hasMore: boolean,
  items: { reference: string | null; size: number; state: string }[],
) {
  if (c.req.method !== "POST") return;
  const sql = c.get("database");
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(8125, 1)`;
    await tx`INSERT INTO file_scan_history (actor_id, kind, started_at, finished_at, continued, has_more, items)
      VALUES (${c.get("userId")}, ${kind}, ${startedAt}, ${finishedAt}, ${continued}, ${hasMore}, ${sql.json(items)})`;
    await tx`DELETE FROM file_scan_history WHERE id IN (SELECT id FROM file_scan_history ORDER BY id DESC OFFSET 50)`;
  });
}

async function retainedObject(c: Context<AppEnv>) {
  const id = z.uuid().safeParse(c.req.param("id"));
  const scanId = z
    .string()
    .regex(/^[1-9]\d{0,18}$/)
    .refine((value) => value.length < 19 || value <= "9223372036854775807")
    .safeParse(c.req.param("scanId"));
  if (!id.success || !scanId.success || id.data !== id.data.toLowerCase())
    throw new ApiFault(
      400,
      "VALIDATION_ERROR",
      "Invalid observation reference.",
    );
  const sql = c.get("database");
  const [scan] = await sql`SELECT finished_at FROM file_scan_history
    WHERE id = ${scanId.data} AND kind = 'objects'
    AND items @> ${sql.json([{ reference: id.data, state: "unreferenced" }])}::jsonb`;
  if (!scan)
    throw new ApiFault(
      404,
      "NOT_FOUND",
      "This unreferenced observation is no longer available. Run a new object scan.",
    );
  return { id: id.data, sql, scan };
}

export const files = new Hono<AppEnv>();
files.use(
  "*",
  authenticate,
  requirePermission("files:read"),
  async (c, next) => {
    if (!c.env.FILES)
      throw new ApiFault(503, "UNAVAILABLE", "File storage is not configured.");
    await next();
  },
);
files.get("/", async (c) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .safeParse(c.req.query("page") ?? "1");
  if (!page.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid file page.");
  const sql = c.get("database");
  let policy;
  try {
    policy = filePolicy(c.env);
  } catch {
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "File quota configuration is invalid. Contact the operator.",
    );
  }
  const [count] =
    await sql`SELECT count(*)::int AS total, COALESCE(sum(size), 0)::text AS bytes FROM managed_files`;
  const usedBytes = Number(count.bytes);
  if (!Number.isSafeInteger(usedBytes))
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "Storage usage cannot be reported safely.",
    );
  const items =
    await sql`SELECT id, name, size, type FROM managed_files ORDER BY created_at DESC, id LIMIT 20 OFFSET ${(page.data - 1) * 20}`;
  return c.json({
    items,
    total: count.total,
    page: page.data,
    storage: { usedBytes, usedCount: count.total, ...policy },
  });
});
// Small independent pages keep hashing bounded; reports are observations, not a storage snapshot.
files.on(
  ["GET", "POST"],
  "/integrity",
  requirePermission("files:review"),
  async (c) => {
    const startedAt = new Date().toISOString();
    const after = z.uuid().optional().safeParse(c.req.query("after"));
    if (!after.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Invalid file scan cursor.");
    const rows = await c.get(
      "database",
    )`SELECT id, name, size, type, checksum FROM managed_files WHERE (${after.data ?? null}::uuid IS NULL OR id > ${after.data ?? null}::uuid) ORDER BY id LIMIT 6`;
    const batch = rows.slice(0, 5);
    const items: z.infer<typeof fileIntegritySchema>["items"] = [];
    for (const row of batch) {
      let state: "healthy" | "missing" | "damaged" | "unavailable" =
        "unavailable";
      try {
        const object = await c.env.FILES!.get(row.id);
        if (!object) state = "missing";
        else if (object.size !== undefined && object.size !== row.size)
          state = "damaged";
        else {
          const bytes = await object.arrayBuffer();
          state =
            bytes.byteLength === row.size &&
            (await digest(bytes)) === row.checksum
              ? "healthy"
              : "damaged";
        }
      } catch {
        /* Report an unavailable check, never mistake a storage failure for missing content. */
      }
      items.push({
        id: row.id,
        name: row.name,
        size: row.size,
        type: row.type,
        state,
      });
    }
    const checkedAt = new Date().toISOString();
    await retainScan(
      c,
      "integrity",
      startedAt,
      checkedAt,
      !!after.data,
      rows.length > 5,
      items.map((item) => ({
        reference: item.id,
        size: item.size,
        state: item.state,
      })),
    );
    return c.json({
      items,
      next: rows.length > 5 ? batch[batch.length - 1].id : null,
      checkedAt,
    });
  },
);
files.on(
  ["GET", "POST"],
  "/objects",
  requirePermission("files:review"),
  async (c) => {
    const startedAt = new Date().toISOString();
    const cursor = z
      .string()
      .min(1)
      .max(4096)
      .optional()
      .safeParse(c.req.query("cursor"));
    if (!cursor.success)
      throw new ApiFault(400, "VALIDATION_ERROR", "Invalid storage cursor.");
    const bucket = c.env.FILES!;
    if (!bucket.list)
      throw new ApiFault(
        503,
        "UNAVAILABLE",
        "This storage adapter does not support object listing.",
      );
    const page = await bucket.list({ limit: 100, cursor: cursor.data });
    if (page.truncated && !page.cursor)
      throw new ApiFault(
        503,
        "UNAVAILABLE",
        "Storage did not return a continuation cursor. Retry this check.",
      );
    const ids = page.objects
      .filter(
        (object) =>
          z.uuid().safeParse(object.key).success &&
          object.key === object.key.toLowerCase(),
      )
      .map((object) => object.key);
    const rows = ids.length
      ? await c.get(
          "database",
        )`SELECT id FROM managed_files WHERE id = ANY(${ids}::uuid[])`
      : [];
    const known = new Set(rows.map((row) => row.id));
    const canonical = new Set(ids);
    const items = page.objects.map((object) => ({
      key: object.key,
      size: object.size,
      state: !canonical.has(object.key)
        ? "unrecognized"
        : known.has(object.key)
          ? "referenced"
          : "unreferenced",
    }));
    const checkedAt = new Date().toISOString();
    await retainScan(
      c,
      "objects",
      startedAt,
      checkedAt,
      !!cursor.data,
      page.truncated,
      items.map((item) => ({
        reference: canonical.has(item.key) ? item.key : null,
        size: item.size,
        state: item.state,
      })),
    );
    return c.json({
      items,
      next: page.truncated ? page.cursor : null,
      checkedAt,
    });
  },
);
files.get("/history", requirePermission("files:review"), async (c) => {
  const rows = await c.get(
    "database",
  )`SELECT id::text, actor_id AS "actorId", kind,
    started_at AS "startedAt", finished_at AS "finishedAt", continued, has_more AS "hasMore", items
    FROM file_scan_history ORDER BY file_scan_history.id DESC LIMIT 50`;
  return c.json({ items: rows, canPreserve: c.get("teamRole") === "owner" });
});
// Investigate only a retained unreferenced observation; never delete or adopt bytes.
files.post(
  "/history/:scanId/objects/:id/check",
  requirePermission("files:review"),
  async (c) => {
    const { id, sql, scan } = await retainedObject(c);
    const result = await sql.begin(async (tx) => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      await tx`SELECT pg_advisory_xact_lock(8124, 1)`;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 8123))`;
      const [record] = await tx`SELECT id FROM managed_files WHERE id = ${id}`;
      if (record) return { state: "referenced" as const, size: null };
      const bucket = c.env.FILES!;
      if (!bucket.head)
        throw new ApiFault(
          503,
          "UNAVAILABLE",
          "This storage adapter does not support object metadata checks.",
        );
      try {
        const object = await bucket.head(id);
        if (!object) return { state: "absent" as const, size: null };
        if (!Number.isSafeInteger(object.size) || object.size < 0)
          throw new Error("Invalid object metadata");
        return { state: "unreferenced" as const, size: object.size };
      } catch {
        return { state: "unavailable" as const, size: null };
      }
    });
    return c.json({
      reference: id,
      observedAt: scan.finished_at,
      checkedAt: new Date().toISOString(),
      ...result,
    });
  },
);
files.post(
  "/history/:scanId/objects/:id/preserve",
  requirePermission("files:review"),
  async (c) => {
    if (c.get("teamRole") !== "owner")
      throw new ApiFault(
        403,
        "FORBIDDEN",
        "Only the owner can export unreferenced bytes.",
      );
    const { id, sql, scan } = await retainedObject(c);
    const bundle = await sql.begin(async (tx) => {
      await tx`SET LOCAL lock_timeout = '5s'`;
      await tx`SELECT pg_advisory_xact_lock(8124, 1)`;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id}, 8123))`;
      const [record] = await tx`SELECT id FROM managed_files WHERE id = ${id}`;
      if (record)
        throw new ApiFault(
          409,
          "CONFLICT",
          "A managed record now exists. Use the normal file workflow.",
        );
      const object = await c.env.FILES!.get(id);
      if (!object)
        throw new ApiFault(
          404,
          "NOT_FOUND",
          "The object is no longer present.",
        );
      if (
        object.size === undefined ||
        !Number.isSafeInteger(object.size) ||
        object.size < 0 ||
        object.size > maxFileSize ||
        !object.version ||
        object.version.length > 256
      )
        throw new ApiFault(
          503,
          "UNAVAILABLE",
          "Preservation requires versioned object metadata and at most 5 MiB. Ask the operator to preserve this object separately.",
        );
      const bytes = await object.arrayBuffer();
      if (bytes.byteLength !== object.size)
        throw new ApiFault(
          503,
          "UNAVAILABLE",
          "Object size changed or storage returned incomplete content. Retry the export.",
        );
      return preservationSchema.parse({
        format: "launchbase-orphan-preservation-v1",
        reference: id,
        storageVersion: object.version,
        capturedAt: new Date().toISOString(),
        observedAt: new Date(scan.finished_at).toISOString(),
        size: bytes.byteLength,
        sha256: await digest(bytes),
        bytes: Buffer.from(bytes).toString("base64"),
      });
    });
    c.header("Cache-Control", "no-store");
    c.header("Content-Disposition", `attachment; filename="orphan-${id}.json"`);
    return c.json(bundle);
  },
);
const uploadFile =
  (requireExisting: boolean): Handler<AppEnv> =>
  async (c) => {
    const id = z
      .uuid()
      .transform((value) => value.toLowerCase())
      .safeParse(c.req.param("id"));
    const type = z.enum(fileTypes).safeParse(c.req.header("Content-Type"));
    let name: string;
    try {
      name = decodeURIComponent(c.req.header("X-File-Name") ?? "");
    } catch {
      name = "";
    }
    if (
      !id.success ||
      !type.success ||
      !name.trim() ||
      name.length > 160 ||
      /[\r\n/\\]/.test(name)
    )
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Provide a valid filename and a PNG, JPEG, or PDF file.",
      );
    const bytes = await c.req.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > maxFileSize)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "Files must be between 1 byte and 5 MiB.",
      );
    const prefix = new Uint8Array(bytes).slice(0, 8);
    const validSignature =
      type.data === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every(
            (byte, i) => prefix[i] === byte,
          )
        : type.data === "image/jpeg"
          ? prefix[0] === 255 && prefix[1] === 216 && prefix[2] === 255
          : new TextDecoder().decode(prefix.slice(0, 5)) === "%PDF-";
    if (!validSignature)
      throw new ApiFault(
        400,
        "VALIDATION_ERROR",
        "File contents do not match the selected type.",
      );
    const checksum = await digest(bytes);
    const sql = c.get("database");
    const bucket = c.env.FILES!;
    const row = await sql.begin(async (tx) => {
      // All application upload/delete paths use the same lock order. This
      // serializes capacity checks with metadata changes across different IDs.
      await tx`SELECT pg_advisory_xact_lock(8124, 1)`;
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id.data}, 8123))`;
      const [existing] =
        await tx`SELECT id, name, size, type, checksum FROM managed_files WHERE id = ${id.data}`;
      if (existing) {
        if (
          existing.checksum !== checksum ||
          existing.name !== name ||
          existing.type !== type.data ||
          existing.size !== bytes.byteLength
        )
          throw new ApiFault(
            409,
            "CONFLICT",
            "This upload ID was already used for another file.",
          );
        // SQL metadata alone cannot prove that the object survived a partial deletion.
        // Restore only the exact originally accepted payload, under the same per-file lock.
        const object = await bucket.get(id.data);
        const stored =
          object && (object.size === undefined || object.size === existing.size)
            ? await object.arrayBuffer()
            : null;
        if (
          !stored ||
          stored.byteLength !== existing.size ||
          (await digest(stored)) !== checksum
        ) {
          await bucket.put(id.data, bytes);
          await recordBusinessAudit(tx, c, "file.restored", "file", id.data);
        }
        return {
          id: existing.id,
          name: existing.name,
          size: existing.size,
          type: existing.type,
        };
      }
      if (requireExisting)
        throw new ApiFault(
          404,
          "NOT_FOUND",
          "This file record no longer exists. Refresh the file list.",
        );
      let policy;
      try {
        policy = filePolicy(c.env);
      } catch {
        throw new ApiFault(
          503,
          "UNAVAILABLE",
          "File quota configuration is invalid. Contact the operator.",
        );
      }
      const [usage] =
        await tx`SELECT count(*)::text AS count, COALESCE(sum(size), 0)::text AS bytes FROM managed_files`;
      const nextCount = Number(usage.count) + 1;
      const nextBytes = Number(usage.bytes) + bytes.byteLength;
      if (!Number.isSafeInteger(nextCount) || !Number.isSafeInteger(nextBytes))
        throw new ApiFault(
          503,
          "UNAVAILABLE",
          "Storage usage cannot be checked safely.",
        );
      if (
        (policy.maxCount !== null && nextCount > policy.maxCount) ||
        (policy.maxBytes !== null && nextBytes > policy.maxBytes)
      )
        throw new ApiFault(
          409,
          "STORAGE_LIMIT",
          "Managed file storage limit reached. Remove unneeded files or ask the owner to review the limit. Existing file recovery remains available.",
        );
      // If the database commit failed after a put, only the original actor and
      // identical upload may finish recording it. Keep unrelated orphans intact.
      const receipt = await digest(
        new TextEncoder().encode(
          JSON.stringify([c.get("userId"), id.data, name, type.data, checksum]),
        ).buffer,
      );
      const uploadIdentity = await digest(new TextEncoder().encode(JSON.stringify([id.data,c.get("userId"),name,type.data,checksum])).buffer);
      const written = await bucket.put(id.data, bytes, {
        onlyIf: new Headers({ "If-None-Match": "*" }),
        customMetadata: { uploadReceipt: receipt, uploadIdentity },
      });
      if (!written) {
        const leftover = await bucket.get(id.data);
        if (
          !leftover || (leftover.customMetadata?.uploadReceipt !== receipt && leftover.customMetadata?.uploadIdentity !== uploadIdentity) ||
          leftover.size !== bytes.byteLength ||
          (await digest(await leftover.arrayBuffer())) !== checksum
        )
          throw new ApiFault(
            409,
            "CONFLICT",
            "This file reference is already in storage. Select the file again to start a new upload.",
          );
      }
      const [created] =
        await tx`INSERT INTO managed_files (id, name, type, size, checksum) VALUES (${id.data}, ${name}, ${type.data}, ${bytes.byteLength}, ${checksum}) RETURNING id, name, size, type`;
      await recordBusinessAudit(tx, c, "file.created", "file", id.data);
      return created;
    });
    return c.json(row);
  };
files.put(
  "/:id",
  requirePermission("files:write"),
  bodyLimit({ maxSize: maxFileSize }),
  uploadFile(false),
);
files.put(
  "/:id/restore",
  requirePermission("files:write"),
  bodyLimit({ maxSize: maxFileSize }),
  uploadFile(true),
);
files.get("/:id", requirePermission("files:download"), async (c) => {
  const id = z
    .uuid()
    .transform((value) => value.toLowerCase())
    .safeParse(c.req.param("id"));
  if (!id.success) throw new ApiFault(404, "NOT_FOUND", "File not found.");
  const [row] = await c.get(
    "database",
  )`SELECT name, size, checksum FROM managed_files WHERE id = ${id.data}`;
  if (!row) throw new ApiFault(404, "NOT_FOUND", "File not found.");
  const object = await c.env.FILES!.get(id.data);
  if (!object)
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "File content is unavailable. Contact the operator.",
    );
  if (object.size !== undefined && object.size !== row.size)
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "File integrity check failed. Contact the operator.",
    );
  const bytes = await object.arrayBuffer();
  if (bytes.byteLength !== row.size || (await digest(bytes)) !== row.checksum)
    throw new ApiFault(
      503,
      "UNAVAILABLE",
      "File integrity check failed. Contact the operator.",
    );
  c.header("Content-Type", "application/octet-stream");
  c.header(
    "Content-Disposition",
    `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(row.name).replace(/['()*]/g, (value) => `%${value.charCodeAt(0).toString(16)}`)}`,
  );
  c.header("Content-Security-Policy", "sandbox; default-src 'none'");
  return c.body(bytes);
});
files.delete("/:id", requirePermission("files:delete"), async (c) => {
  const id = z
    .uuid()
    .transform((value) => value.toLowerCase())
    .safeParse(c.req.param("id"));
  if (!id.success)
    throw new ApiFault(400, "VALIDATION_ERROR", "Invalid file reference.");
  await c.get("database").begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(8124, 1)`;
    await tx`SELECT pg_advisory_xact_lock(hashtextextended(${id.data}, 8123))`;
    const [existing] =
      await tx`SELECT id FROM managed_files WHERE id = ${id.data} FOR UPDATE`;
    // A missing record is an idempotent no-op, not permission to remove an
    // unreferenced object. Failed uploads need those bytes for investigation.
    if (!existing) return;
    await c.env.FILES!.delete(id.data);
    const removed =
      await tx`DELETE FROM managed_files WHERE id = ${id.data} RETURNING id`;
    if (removed.length)
      await recordBusinessAudit(tx, c, "file.deleted", "file", id.data);
  });
  return c.body(null, 204);
});
