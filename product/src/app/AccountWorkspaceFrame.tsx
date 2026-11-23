import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth";
import { apiRequest } from "@/api/client";
import { accessSchema } from "../../shared/access";
import { adminNavigation } from "./adminNavigation";
import { customerNavigation } from "./customerNavigation";
import { WorkspaceFrame } from "./WorkspaceFrame";
import { readWorkspaceContext } from "./workspaceContext";

/** Personal settings retain workspace context; access is still checked live. */
export function AccountWorkspaceFrame({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const preferred = readWorkspaceContext(userId);
  const access = useQuery({
    queryKey: ["portal-menu", userId],
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => apiRequest("/access", { signal }, accessSchema),
  });
  const pending = session.isPending || (!!userId && access.isPending);
  const admin =
    preferred === "admin" || (preferred === null && !!access.data?.teamRole);
  return (
    <WorkspaceFrame
      title={admin ? "Administration" : "My workspace"}
      context={admin ? "Client workspace" : "Customer workspace"}
      links={
        admin
          ? adminNavigation(
              access.isError || access.data?.mfaRequired
                ? undefined
                : access.data,
            )
          : pending
            ? []
            : customerNavigation
      }
      navigationLoading={pending}
    >
      <div className="customer-content">{children}</div>
    </WorkspaceFrame>
  );
}
