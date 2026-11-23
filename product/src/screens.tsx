"use client";
import { type ReactNode } from "react";
import NextLink from "next/link";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "./lib/auth";
import { apiRequest, ApiError } from "./api/client";
import { accessSchema } from "../shared/access";
import { AccountWorkspaceFrame } from "./app/AccountWorkspaceFrame";
import { WorkspaceFrame } from "./app/WorkspaceFrame";
import { CustomerFrame } from "./components/layouts/CustomerFrame";
import { AccountPage } from "./features/account/AccountPage";
import { InvitePage } from "./features/account/InvitePage";
import { TwoFactorPage } from "./features/account/TwoFactorPage";
import { SecurityPage } from "./features/account/SecurityPage";
import { WorkspacePage } from "./features/workspace/WorkspacePage";
import { adminNavigation } from "./app/adminNavigation";

function Guest({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="site-header">
        <NextLink className="brand" href="/">
          AppsInHours
        </NextLink>
        <NextLink href="/work">Return to work</NextLink>
      </header>
      <main className="page-content">{children}</main>
    </>
  );
}
function AccountFrame({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  return session.data ? (
    <AccountWorkspaceFrame>{children}</AccountWorkspaceFrame>
  ) : (
    <Guest>{children}</Guest>
  );
}
export function Account() {
  return (
    <AccountFrame>
      <AccountPage />
    </AccountFrame>
  );
}
export function Security() {
  return (
    <AccountFrame>
      <SecurityPage />
    </AccountFrame>
  );
}
export function TwoFactor() {
  return (
    <AccountFrame>
      <TwoFactorPage />
    </AccountFrame>
  );
}
export function Invite() {
  return (
    <Guest>
      <InvitePage />
    </Guest>
  );
}
export function Records() {
  return (
    <CustomerFrame>
      <WorkspacePage />
    </CustomerFrame>
  );
}
export function Administration() {
  const session = authClient.useSession(),
    id = session.data?.user.id;
  const access = useQuery({
    queryKey: ["admin-overview", id],
    enabled: !!id,
    queryFn: ({ signal }) => apiRequest("/admin", { signal }, accessSchema),
  });
  return (
    <WorkspaceFrame
      title="Administration"
      context="Client workspace"
      links={adminNavigation(access.data)}
    >
      <section className="component-card">
        <h1>Administration</h1>
        {session.isPending || (id && access.isPending) ? (
          <p role="status">Checking team access…</p>
        ) : !id ? (
          <NextLink href="/app/account">Sign in to continue</NextLink>
        ) : access.isError ? (
          <p role="alert">
            {access.error instanceof ApiError
              ? access.error.message
              : "Team access is unavailable."}
          </p>
        ) : access.data?.mfaRequired ? (
          <NextLink href="/app/account/two-factor">
            Verify two-factor authentication
          </NextLink>
        ) : (
          <>
            <p>Signed in as {access.data?.teamRole}.</p>
            <NextLink href="/app/account">Open your profile</NextLink>
          </>
        )}
      </section>
    </WorkspaceFrame>
  );
}
