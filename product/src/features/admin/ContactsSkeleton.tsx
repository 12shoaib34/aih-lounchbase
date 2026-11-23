import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Button } from "@/components/ui/Button";
import { pageDescriptions } from "@/app/pageMetadata";

const Value = () => <span className="invoice-loading-value" />;

export function ContactsSkeleton() {
  return (
    <div className="contacts-page" aria-busy="true">
      <PageHeader
        title="Contacts"
        description={pageDescriptions.Contacts}
        actions={
          <div className="skeleton-controls" inert aria-hidden="true">
            <Button>Add contact</Button>
          </div>
        }
      />
      <div className="contacts-controls" inert aria-hidden="true">
        <form className="directory-search">
          <Field
            label="Search contacts"
            type="search"
            placeholder="Name, email or company"
            readOnly
          />
          <Button variant="secondary">Search contacts</Button>
        </form>
        <div className="contact-toolbar">
          <SelectField label="Contact status">
            <option>Active</option>
          </SelectField>
          <Button variant="secondary">Reset filters</Button>
          <Button variant="secondary">Refresh contacts</Button>
        </div>
      </div>
      <details className="component-card" inert aria-hidden="true">
        <summary>
          <Value />
        </summary>
      </details>
      <ContactResultsSkeleton />
    </div>
  );
}

export function ContactResultsSkeleton({
  canWrite = true,
}: {
  canWrite?: boolean;
}) {
  return (
    <div aria-busy="true" className="contact-results-loading">
      <p className="list-result-summary" role="status">
        <span className="sr-only">Loading contacts…</span>
        <Value />
      </p>
      <div className="contacts-table-wrap" aria-hidden="true">
        <table className="data-table contacts-table">
          <thead>
            <tr>
              {["Name / email", "Company", "Status", "Actions"].map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <Value />
                <span className="contact-email">
                  <Value />
                </span>
              </th>
              <td data-label="Company">
                <Value />
              </td>
              <td data-label="Status">
                <span className="contact-status">
                  <Value />
                </span>
              </td>
              <td data-label="Actions">
                <span
                  className={
                    canWrite ? "button button-secondary skeleton-controls" : ""
                  }
                >
                  <Value />
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div inert aria-hidden="true">
        <Pagination
          label="Contact pages"
          page={1}
          pageSize={20}
          total={0}
          loading
        />
      </div>
    </div>
  );
}

export function ContactDetailsSkeleton() {
  return (
    <div className="contact-detail">
      <PageHeader title="Contact details" />
      <ContactDetailsBodySkeleton />
    </div>
  );
}

export function ContactDetailsBodySkeleton({
  canWrite = true,
}: {
  canWrite?: boolean;
}) {
  return (
    <>
      <span className="sr-only" role="status">
        Loading contact…
      </span>
      <header className="contact-record-heading" aria-hidden="true">
        <div>
          <h2>
            <Value />
          </h2>
          <span className="contact-status">
            <Value />
          </span>
        </div>
        <div className="contact-record-actions skeleton-controls" inert>
          <Button variant="secondary">Refresh contact</Button>
          {canWrite && <Button>Edit contact</Button>}
        </div>
      </header>
      <div className="contact-detail-columns" aria-hidden="true">
        <section>
          <h3>Contact information</h3>
          <dl>
            <dt>Email</dt>
            <dd>
              <Value />
            </dd>
            <dt>Phone</dt>
            <dd>
              <Value />
            </dd>
          </dl>
        </section>
        <section>
          <h3>Organization and tags</h3>
          <dl>
            <dt>Company</dt>
            <dd>
              <Value />
            </dd>
            <dt>Tags</dt>
            <dd>
              <Value />
            </dd>
          </dl>
        </section>
      </div>
      <section className="contact-notes" aria-hidden="true">
        <h3>Private notes</h3>
        <p>
          <Value />
        </p>
        <p className="hint">Visible to team members with contact access.</p>
      </section>
    </>
  );
}
