import {
  AccountsSkeleton,
  AuditResultsSkeleton,
  BusinessSkeleton,
  OverviewSkeleton,
  TeamSkeleton,
} from "@/features/admin/AdminSkeletons";
import { LoadingContent, LoadingTable } from "@/components/ui/LoadingContent";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/PageLoading";

/** App-owned public route composition; permission-dependent forms mount after access. */
export function AdminLoadingContent({ title }: { title: string }) {
  switch (title) {
    case "Overview":
      return <OverviewSkeleton />;
    case "Accounts":
      return <AccountsSkeleton />;
    case "Business settings":
      return <BusinessSkeleton />;
    case "Team":
      return (
        <>
          <p className="hint">
            Invite people to help manage your business. Only the owner can
            manage team access.
          </p>
          <TeamSkeleton />
        </>
      );
    case "Files":
      return (
        <>
          <p className="lede">
            Private business files. PNG, JPEG and PDF files up to 5 MiB.
            Downloads are attachments; files are not published on the website.
          </p>
          <LoadingTable
            label="Loading files…"
            columns={["File", "Size", "Actions"]}
            pagination
          />
        </>
      );
    case "Scheduling":
      return (
        <>
          <h2>Latest 100 bookings</h2>
          <LoadingTable
            label="Loading bookings…"
            columns={["Resource", "Time", "Status", "Actions"]}
          />
        </>
      );
    case "Scheduled notifications":
      return (
        <>
          <p className="lede">
            Review scheduled messages and email delivery history.
          </p>
          <h2>Latest 100 notifications</h2>
          <LoadingTable
            label="Loading scheduled messages…"
            columns={["Title", "Due", "State", "Email", "Actions"]}
          />
        </>
      );
    case "Audit trail":
      return (
        <>
          <LoadingContent label="Loading audit filters…">
            <form className="audit-filters">
              <SelectField label="Event type">
                <option>All events</option>
              </SelectField>
              <Field label="From date (UTC)" type="date" readOnly />
              <Field label="Through date (UTC)" type="date" readOnly />
              <details className="audit-reference-filters">
                <summary>Filter by actor or target reference</summary>
              </details>
              <div className="account-actions">
                <Button>Apply audit filters</Button>
                <Button variant="secondary">Reset audit filters</Button>
              </div>
            </form>
            <div className="record-toolbar">
              <p className="hint">
                Names reflect current accounts. Event references remain when an
                account is deleted.
              </p>
              <Button variant="secondary">Refresh audit trail</Button>
            </div>
          </LoadingContent>
          <AuditResultsSkeleton />
        </>
      );
    default:
      return <PageLoading title={title} />;
  }
}
