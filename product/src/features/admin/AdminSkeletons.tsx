import { emptyBusiness } from "./businessSettingsData";
import {
  BusinessProfileFields,
  BusinessSectionNav,
} from "./BusinessSettingsFields";
import { PaginationControls } from "@/components/ui/Pagination";
import {
  LoadingContent,
  LoadingValue,
  LoadingTable,
} from "@/components/ui/LoadingContent";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function AccountsSkeleton() {
  return (
    <LoadingContent label="Loading accounts…">
      <section className="directory">
        <p className="hint">
          Registered customers and team members. Team access is assigned
          separately.
        </p>
        <form className="directory-search">
          <Field
            label="Search accounts"
            type="search"
            placeholder="Name or email"
            readOnly
          />
          <Button>Search</Button>
        </form>
        <LoadingTable
          label="Loading accounts…"
          columns={["Name", "Email", "Email status", "Team access"]}
          count
          pagination
        />
      </section>
    </LoadingContent>
  );
}

export function BusinessSkeleton() {
  return (
    <LoadingContent label="Loading settings…">
      <BusinessSectionNav />
      <form className="business-settings-form">
        <BusinessProfileFields
          draft={emptyBusiness}
          update={() => {}}
          errors={{}}
          disabled
          onLogoLoading={() => {}}
        />
        <div className="business-save">
          <LoadingValue />
          <Button>Save business settings</Button>
        </div>
      </form>
    </LoadingContent>
  );
}

export function OverviewSkeleton() {
  return (
    <LoadingContent label="Loading overview…">
      <div className="admin-overview">
        <p className="lede">
          Your business workspace. Choose a task to get started.
        </p>
        <div className="overview-summary">
          {["Business details", "Account directory"].map((title) => (
            <section className="overview-stat" key={title}>
              <h2>{title}</h2>
              <strong>
                <LoadingValue />
              </strong>
              <p>
                <LoadingValue />
              </p>
              <LoadingValue />
            </section>
          ))}
        </div>
        <section>
          <h2>Workspace tools</h2>
          <div className="overview-tools">
            {[0, 1, 2, 3].map((key) => (
              <div className="overview-tool" key={key}>
                <LoadingValue />
                <span>
                  <strong>
                    <LoadingValue />
                  </strong>
                  <span>
                    <LoadingValue />
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </LoadingContent>
  );
}

export function TeamSkeleton() {
  return (
    <LoadingContent label="Loading team…">
      <p>
        <LoadingValue />
      </p>
      <h3>Members</h3>
      <div className="team-list">
        <section className="component-card">
          <strong>
            <LoadingValue />
          </strong>
          <p className="team-email">
            <LoadingValue />
          </p>
          <p>
            <LoadingValue />
          </p>
        </section>
      </div>
      <h3>Pending invitations</h3>
      <p>
        <LoadingValue />
      </p>
    </LoadingContent>
  );
}

export function AuditResultsSkeleton() {
  return (
    <LoadingContent label="Loading audit events…">
      <p>
        <LoadingValue />
      </p>
      <ol className="audit-list">
        <li className="component-card">
          <div className="audit-event-heading">
            <h2>
              <LoadingValue />
            </h2>
            <LoadingValue />
          </div>
          <p>
            <LoadingValue />
          </p>
          <p>
            <LoadingValue />
          </p>
        </li>
      </ol>
      <PaginationControls
        label="Audit event pages"
        indicator={<LoadingValue />}
        previousLabel="Newest events"
        nextLabel="Older events"
        previousDisabled
        nextDisabled
      />
    </LoadingContent>
  );
}
