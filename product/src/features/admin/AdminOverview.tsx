import { PageLoading } from "@/components/ui/PageLoading";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/navigation";
import { z } from "zod";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { adminNavigation } from "@/app/adminNavigation";
import { NavigationIcon } from "@/components/layouts/NavigationIcon";
import { accessSchema, usersPageSchema } from "../../../shared/access";
import { businessSchema } from "../../../shared/business";
const descriptions: Record<string, string> = {
  Team: "Invite people and manage their access.",
  Accounts: "Find registered customers and team accounts.",
  "Business settings":
    "Manage business details, locations and regional settings.",
  Contacts: "Keep contact details, notes and imports organized.",
  Files: "Manage private files and review storage health.",
  Notifications: "Schedule messages and review delivery.",
  Scheduling: "Manage resources and customer reservations.",
  Billing: "Create invoices and review payment records.",
  "Audit trail": "Review administrative changes and their references.",
};
export function AdminOverview({
  access,
}: {
  access: z.infer<typeof accessSchema>;
}) {
  const links = adminNavigation(access).filter((link) => link.to !== "/admin");
  return (
    <div className="admin-overview">
      <p className="lede">
        Your business workspace. Choose a task to get started.
      </p>
      {(access.teamRole === "owner" ||
        access.permissions.includes("users:read")) && (
        <div className="overview-summary">
          {access.teamRole === "owner" && (
            <BusinessSummary userId={access.userId} />
          )}
          {access.permissions.includes("users:read") && (
            <AccountSummary userId={access.userId} />
          )}
        </div>
      )}
      <section aria-labelledby="workspace-tools-title">
        <h2 id="workspace-tools-title">Workspace tools</h2>
        {links.length ? (
          <div className="overview-tools">
            {links.map((link) => (
              <Link
                className="overview-tool"
                key={link.to}
                to={link.to}
                aria-label={`Open ${link.label}`}
              >
                <NavigationIcon to={link.to} />
                <span>
                  <strong>{link.label}</strong>
                  <span>{descriptions[link.label]}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="portal-empty">
            <h3>No modules assigned yet</h3>
            <p>
              Ask the owner to grant the access you need. Your personal account
              remains available.
            </p>
            <Link to="/account">Open your profile</Link>
          </div>
        )}
      </section>
    </div>
  );
}
function AccountSummary({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ["admin", "overview-accounts", userId],
    queryFn: ({ signal }) =>
      apiRequest("/admin/users?page=1", { signal }, usersPageSchema),
    retry: false,
    staleTime: 0,
  });
  return (
    <section className="overview-stat">
      <h2>Account directory</h2>
      {query.isPending ? (
        <PageLoading label="Loading account total…" layout="inline" />
      ) : query.isError ? (
        <>
          <p role="alert">Account total unavailable.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry account total
          </Button>
        </>
      ) : (
        <>
          <strong>
            {query.data.total.toLocaleString()} registered{" "}
            {query.data.total === 1 ? "account" : "accounts"}
          </strong>
          <p>Customers and team members registered in this installation.</p>
          <Link to="/admin/accounts">View account directory</Link>
        </>
      )}
    </section>
  );
}
function BusinessSummary({ userId }: { userId: string }) {
  const query = useQuery({
    queryKey: ["admin", "overview-business", userId],
    queryFn: ({ signal }) =>
      apiRequest("/business", { signal }, businessSchema),
    retry: false,
    staleTime: 0,
  });
  return (
    <section className="overview-stat">
      <h2>Business details</h2>
      {query.isPending ? (
        <PageLoading label="Checking business details…" layout="inline" />
      ) : query.isError ? (
        <>
          <p role="alert">Business details unavailable.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry business details
          </Button>
        </>
      ) : (
        <>
          <strong className="overview-business-name">
            {query.data.data?.name || "Not set up yet"}
          </strong>
          <p>
            {query.data.data
              ? `${query.data.data.timezone} · ${query.data.data.currency}`
              : "Add your business identity and regional preferences."}
          </p>
          <Link to="/admin/business">
            {query.data.data
              ? "Review business details"
              : "Set up business details"}
          </Link>
        </>
      )}
    </section>
  );
}
