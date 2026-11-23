import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { GET as dispatch } from "../api/[...endpoint]/route";
export default async function Entry() {
  const incoming = await headers();
  if (!incoming.get("cookie")) redirect("/app/account");
  const result = await dispatch(
    new Request("http://internal/api/access", { headers: incoming }),
  );
  if (!result.ok) redirect("/app/account");
  const access = await result.json();
  redirect(
    access.mfaRequired
      ? "/app/account/two-factor"
      : access.teamRole
        ? "/app/admin"
        : "/app/workspace",
  );
}
