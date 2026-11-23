import {
  LoadingContent,
  LoadingValue,
  LoadingPagination,
  LoadingTable,
} from "@/components/ui/LoadingContent";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";

export function RecordsResultsSkeleton() {
  return (
    <LoadingContent label="Loading records…">
      <div className="record-toolbar">
        <p>
          <LoadingValue />
        </p>
        <Button>Archive selected</Button>
        <Button variant="secondary">Refresh records</Button>
      </div>
      <label className="select-page">
        <input type="checkbox" disabled /> Select active records on this page
      </label>
      <div className="records-list">
        <article className="record-row">
          <span className="record-select">
            <input type="checkbox" disabled />
          </span>
          <div className="record-details">
            <h2>
              <LoadingValue />
            </h2>
            <p>
              <LoadingValue />
            </p>
          </div>
          <span className="record-status">
            <LoadingValue />
          </span>
          <Button variant="secondary">Edit</Button>
        </article>
      </div>
      <LoadingPagination />
    </LoadingContent>
  );
}

export function RecordsSkeleton() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1>My records</h1>
          <p className="lede">Create, organize, and manage your records.</p>
        </div>
        <span className="button skeleton-controls" aria-hidden="true">
          Create record
        </span>
      </div>
      <form className="record-filters" inert aria-hidden="true">
        <Field
          label="Search records"
          type="search"
          placeholder="Search by title"
          readOnly
        />
        {[
          ["Filter by status", "All statuses"],
          ["Sort records", "Newest first"],
          ["Records per page", "10"],
        ].map(([label, value]) => (
          <SelectField key={label} label={label}>
            <option>{value}</option>
          </SelectField>
        ))}
        <Button>Apply filters</Button>
        <Button variant="secondary">Reset filters</Button>
      </form>
      <RecordsResultsSkeleton />
    </>
  );
}

export function CustomerInvoicesSkeleton({ full = false }: { full?: boolean }) {
  return (
    <>
      {full && (
        <>
          <h1>My billing</h1>
          <p className="lede">
            Review your issued invoices. Payments may take a moment to confirm;
            refresh to check their status.
          </p>
          <Button variant="secondary" disabled>
            Refresh invoices
          </Button>
        </>
      )}
      <LoadingContent label="Loading invoices…">
        <p>
          <LoadingValue />
        </p>
        <article className="component-card">
          <h2>
            <LoadingValue />
          </h2>
          <p>
            <LoadingValue />
          </p>
          <ul>
            <li>
              <LoadingValue />
            </li>
          </ul>
        </article>
      </LoadingContent>
    </>
  );
}

export function InboxSkeleton({ full = false }: { full?: boolean }) {
  return (
    <>
      {full && (
        <>
          <h1>Notifications</h1>
          <Button variant="secondary" disabled>
            Refresh notifications
          </Button>
          <InboxPreferencesSkeleton />
        </>
      )}
      <LoadingContent label="Loading notifications…">
        <article className="component-card">
          <h2>
            <LoadingValue />
          </h2>
          <p className="hint">
            <LoadingValue />
          </p>
          <p>
            <LoadingValue />
          </p>
          <Button variant="secondary">Mark as read</Button>
        </article>
        <LoadingPagination />
      </LoadingContent>
    </>
  );
}

export function InboxPreferencesSkeleton() {
  return (
    <LoadingContent label="Loading notification preferences…">
      <div className="component-card">
        <label>
          <input type="checkbox" disabled /> Email me optional account
          notifications
        </label>
        <span className="hint">
          Off by default. Security and account recovery emails are always sent.
          A message already being sent may still arrive after you opt out.
        </span>
      </div>
    </LoadingContent>
  );
}

export function BookingsSkeleton() {
  return (
    <>
      <h1>My bookings</h1>
      <LoadingContent label="Loading bookings…">
        <h2>Reserve a time</h2>
        <p>
          Enter times in your device timezone (
          {Intl.DateTimeFormat().resolvedOptions().timeZone}). Book 15 minutes
          to 8 hours, up to 180 days ahead. Availability is checked when you
          submit.
        </p>
        <form className="component-card">
          <fieldset className="settings-fields">
            <legend>Reservation</legend>
            <SelectField label="Resource" required>
              <option />
            </SelectField>
            <Field label="Starts" required type="datetime-local" readOnly />
            <Field label="Ends" required type="datetime-local" readOnly />
          </fieldset>
          <Button>Book</Button>
        </form>
        <LoadingTable
          label="Loading bookings…"
          columns={["Resource", "Time", "Status", "Actions"]}
        />
      </LoadingContent>
    </>
  );
}
