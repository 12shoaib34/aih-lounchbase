import {useRouter} from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NavigationIcon } from "./NavigationIcon";
import { authClient } from "@/lib/auth";
import { apiRequest } from "@/api/client";
import { accessSchema } from "../../../shared/access";

export function WorkspaceMenu() {
  const router = useRouter();
  const cache = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const location = useLocation();
  const menu = useRef<HTMLDetailsElement>(null);
  const access = useQuery({
    queryKey: ["portal-menu", userId],
    enabled: !!userId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => apiRequest("/access", { signal }, accessSchema),
  });
  useEffect(() => {
    menu.current?.removeAttribute("open");
  }, [location.pathname]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        menu.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  if (!userId)
    return (
      <Link
        className="workspace-account workspace-avatar"
        to="/account"
        aria-label="My account"
        title="My account"
      >
        <NavigationIcon to="/account" />
      </Link>
    );
  return (
    <details
      ref={menu}
      className="workspace-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menu.current?.open) {
          event.preventDefault();
          menu.current.open = false;
          menu.current.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="My account" title="My account">
        <span className="workspace-avatar" aria-hidden="true">
          <NavigationIcon to="/account" />
        </span>
      </summary>
      <nav
        aria-label="Workspace switching"
        onClick={(event) => {
          if (event.target instanceof Element && event.target.closest("a")) {
            menu.current?.removeAttribute("open");
            menu.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <div className="workspace-menu-identity">
          <strong>{session.data?.user.name || "My account"}</strong>
          <span>{session.data?.user.email}</span>
        </div>
        <Link to="/account">Profile</Link>
        <Link to="/workspace">Customer workspace</Link>
        <Link to="/account/security">Security settings</Link>
        {!access.isError && access.data?.mfaRequired ? (
          <Link to="/account/two-factor">Verify business access</Link>
        ) : !access.isError && access.data?.teamRole ? (
          <Link to="/admin">Business workspace</Link>
        ) : null}
        {access.isError && (
          <p role="alert">
            Business access unavailable.{" "}
            <button type="button" onClick={() => void access.refetch()}>
              Retry
            </button>
          </p>
        )}
        <div className="workspace-menu-session">
          <button
            type="button"
            disabled={signingOut}
            onClick={async () => {
              setError("");
              // Editors can veto session end while changes or a save are pending.
              if (
                !window.dispatchEvent(
                  new Event("launchbase:before-session-end", {
                    cancelable: true,
                  }),
                )
              ) {
                setError("Save or discard your changes before signing out.");
                return;
              }
              setSigningOut(true);
              try {
                const result = await authClient.signOut();
                if (result.error) throw new Error();
                await cache.cancelQueries();
                cache.clear();
                router.replace("/app/account");
              } catch {
                setError("Sign-out failed. Please try again.");
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </nav>
    </details>
  );
}
