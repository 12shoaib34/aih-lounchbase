import { PageLoading } from "@/components/ui/PageLoading";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/navigation";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { accessSchema } from "../../../shared/access";

export function AccountNavigation({ userId }: { userId: string }) {
  const cache = useQueryClient();
  const queryKey = ["account-navigation", userId];
  const access = useQuery({
    queryKey,
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      try {
        return await apiRequest("/admin", { signal }, accessSchema);
      } catch (error) {
        if (error instanceof ApiError && error.status === 403) return null;
        throw error;
      }
    },
  });
  useEffect(
    () => () => {
      cache.removeQueries({
        queryKey: ["account-navigation", userId],
        exact: true,
      });
    },
    [cache, userId],
  );
  return (
    <nav className="account-navigation" aria-label="Account shortcuts">
      <section>
        <h2>My workspace</h2>
        <ul>
          <li>
            <Link to="/workspace">
              <span>Open my workspace</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        </ul>
      </section>
      <section>
        <h2>Security</h2>
        <ul>
          <li>
            <Link to="/account/security">
              <span>Account security</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
          <li>
            <Link to="/account/two-factor">
              <span>Two-factor authentication</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        </ul>
      </section>
      {access.isPending ? (
        <PageLoading label="Checking team access…" layout="inline" />
      ) : access.isError ? (
        <div>
          <p role="alert">
            Team access could not be checked. Your personal workspace is still
            available.
          </p>
          <Button variant="secondary" onClick={() => void access.refetch()}>
            Retry team access
          </Button>
        </div>
      ) : access.data?.mfaRequired ? (
        <section>
          <h2>Administration</h2>
          <Link to="/account/two-factor">
            Verify two-factor authentication for administration
          </Link>
        </section>
      ) : access.data?.teamRole ? (
        <section>
          <h2>Administration</h2>
          <Link to="/admin">
            <span>Open administration</span>
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      ) : null}
    </nav>
  );
}
