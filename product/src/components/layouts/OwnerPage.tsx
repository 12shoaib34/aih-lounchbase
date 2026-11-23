import { pageDescriptions } from "@/app/pageMetadata";
import { PageHeader } from "../ui/PageHeader";
import { AdminLoadingContent } from "@/app/AdminLoadingContent";
import { adminNavigation } from "@/app/adminNavigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/navigation";
import { apiRequest, ApiError } from "@/api/client";
import { accessSchema, type Permission } from "../../../shared/access";
import { WorkspaceFrame } from "@/app/WorkspaceFrame";
import { Button } from "../ui/Button";

export function OwnerPage({
  title,
  children,
  permission,
  loading,
  contentHeader = false,
  breadcrumbs,
}: {
  title: string;
  children: (userId: string, permissions: Permission[]) => ReactNode;
  permission?: Permission;
  loading?: ReactNode;
  contentHeader?: boolean;
  breadcrumbs?: ReactNode;
}) {
  const cache = useQueryClient();
  const access = useQuery({
    // A newly opened module must not mount its form from the previous page's
    // access result while that page's cleanup clears the shared owner cache.
    queryKey: ["owner", "access", title],
    queryFn: ({ signal }) => apiRequest("/admin", { signal }, accessSchema),
    retry: false,
    staleTime: 0,
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["owner"] });
    },
    [cache],
  );
  const blocked =
    !access.isPending &&
    (access.isError ||
      access.data?.mfaRequired ||
      (permission
        ? !access.data?.teamRole ||
          !access.data.permissions.includes(permission)
        : access.data?.teamRole !== "owner"));
  const notice = useRef<HTMLParagraphElement>(null);
  const previouslyAllowed = useRef(false);
  const previouslyBlocked = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (blocked && previouslyAllowed.current) notice.current?.focus();
    if (!access.isPending) {
      if (!blocked && previouslyBlocked.current)
        (
          heading.current ??
          document.querySelector<HTMLElement>(".workspace-content h1")
        )?.focus();
      previouslyAllowed.current = !blocked;
      previouslyBlocked.current = blocked;
    }
  }, [blocked, access.isPending]);
  const status =
    access.error instanceof ApiError ? access.error.status : undefined;
  const accessMessage = access.data?.mfaRequired
    ? "Verify an authenticator or recovery code for this session to access administration."
    : access.isError && status !== 401 && status !== 403
      ? "We could not check your access. Check your connection and try again."
      : status === 401
        ? "Your session has expired. Sign in again to continue."
        : permission
          ? "Your account does not have access to this module. Ask the owner to review your permissions."
          : "Owner access is required. Sign in with the owner account or try again.";
  return (
    <WorkspaceFrame
      title="Administration"
      context="Client workspace"
      navigationLoading={access.isPending}
      links={adminNavigation(access.isError ? undefined : access.data)}
    >
      {(!contentHeader || blocked || (access.isPending && !loading)) && (
        <PageHeader
          title={title}
          description={pageDescriptions[title]}
          headingRef={heading}
          breadcrumbs={breadcrumbs}
        />
      )}
      {access.isPending ? (
        (loading ?? <AdminLoadingContent title={title} />)
      ) : blocked ? (
        <section className="component-card">
          <p ref={notice} tabIndex={-1} role="alert">
            {accessMessage}
          </p>
          {access.data?.mfaRequired && (
            <Link to="/account/two-factor">
              Set up or verify two-factor authentication
            </Link>
          )}
          <Link to="/account">Go to my account</Link>
          <Button onClick={() => void access.refetch()}>Check again</Button>
        </section>
      ) : (
        access.data && children(access.data.userId, access.data.permissions)
      )}
    </WorkspaceFrame>
  );
}
