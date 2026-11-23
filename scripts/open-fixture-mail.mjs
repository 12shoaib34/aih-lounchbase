// Operator-only local mailbox. Never accepts a remote database URL or opens a remote link.
import postgres from "postgres";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fixtureDatabase, origin } from "./identity-endpoints.mjs";
const email = process.argv[2]?.trim();
if (!email)
  throw Error("Pass the email address you used in the local preview.");
const sql = postgres(fixtureDatabase, { max: 1 });
try {
  const [row] =
    await sql`SELECT url FROM auth_mail_outbox WHERE lower(recipient)=lower(${email}) ORDER BY id DESC LIMIT 1`;
  if (!row) throw Error("No local mail yet for this address.");
  const url = new URL(row.url);
  if (url.origin !== origin)
    throw Error("Mail link belongs to a different preview.");
  const child = spawn(
    process.platform === "darwin" ? "open" : "xdg-open",
    [url.href],
    { stdio: "ignore" },
  );
  if ((await once(child, "exit"))[0] !== 0)
    throw Error("Could not open the local mail link.");
} finally {
  await sql.end();
}
