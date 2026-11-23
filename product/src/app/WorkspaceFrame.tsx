import { useEffect, type ComponentProps } from "react";
import { authClient } from "@/lib/auth";
import { rememberWorkspaceContext } from "./workspaceContext";
import { useLocation } from "@/navigation";
import { WorkspaceShell } from "@/components/layouts/WorkspaceShell";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { pageTitles } from "./pageMetadata";

/** Public route hierarchy only; protected record labels come from feature headers. */
export function WorkspaceFrame(props: ComponentProps<typeof WorkspaceShell>) {
  const { pathname, search } = useLocation();
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  useEffect(() => {
    if (!userId) return;
    if (pathname.startsWith("/admin"))
      rememberWorkspaceContext(userId, "admin");
    else if (
      [
        "/workspace",
        "/account/billing",
        "/account/bookings",
        "/account/notifications",
      ].includes(pathname)
    )
      rememberWorkspaceContext(userId, "customer");
  }, [pathname, userId]);
  const section = pathname.startsWith("/admin/billing/")
    ? { label: "Billing", to: `/admin/billing${search}` }
    : pathname.startsWith("/admin/contacts/")
      ? { label: "Contacts", to: `/admin/contacts${search}` }
      : pathname.startsWith("/admin") || props.title === "Administration"
        ? { label: "Administration", to: "/admin" }
        : { label: "My workspace", to: "/account" };
  const current =
    (pathname === "/account" ? "Profile" : pageTitles[pathname]) ??
    (pathname.startsWith("/admin/billing/")
      ? pathname.endsWith("/edit")
        ? "Edit draft"
        : "Invoice details"
      : pathname.startsWith("/admin/contacts/")
        ? "Contact details"
        : props.title);
  return (
    <WorkspaceShell
      {...props}
      breadcrumbs={
        <Breadcrumbs
          items={
            pathname === "/components"
              ? [{ label: current }]
              : [section, { label: current }]
          }
        />
      }
    />
  );
}
