import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export function ProfileDetailsSkeleton() {
  return (
    <div
      className="profile-details profile-loading"
      aria-busy="true"
      aria-label="Loading personal details"
    >
      <div className="profile-section-heading">
        <h2>Personal details</h2>
        <p className="hint">Choose the name displayed on your account.</p>
      </div>
      <Field
        label="Display name"
        name="loading-display-name"
        disabled
        value=""
        readOnly
      />
      <Button disabled>Save changes</Button>
      <span className="sr-only" role="status">
        Loading your profile…
      </span>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <section className="panel account-profile">
      <h1>Profile</h1>
      <p className="lede">
        Manage your personal details, workspace and account security.
      </p>
      <ProfileDetailsSkeleton />
    </section>
  );
}
