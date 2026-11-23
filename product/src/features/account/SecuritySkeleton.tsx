import { LoadingContent, LoadingValue } from "@/components/ui/LoadingContent";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function SecuritySkeleton({
  twoFactor = false,
}: {
  twoFactor?: boolean;
}) {
  if (twoFactor)
    return (
      <section className="panel">
        <h1>Two-factor authentication</h1>
        <LoadingContent label="Checking your account…">
          <p>
            Add an authenticator app and keep recovery codes somewhere private.
            Administrators may need to verify a code for their current session
            before accessing business tools.
          </p>
          <p>
            Enabling or disabling two-factor authentication signs out existing
            sessions. This browser receives a replacement session when the
            change succeeds.
          </p>
          <p>
            Status: <LoadingValue />
          </p>
          <Field label="Password" type="password" readOnly />
          <span className="button skeleton-controls">
            <LoadingValue />
          </span>
        </LoadingContent>
      </section>
    );
  return (
    <section className="component-page security-page">
      <p className="eyebrow">Your account</p>
      <h1>Account security</h1>
      <p className="lede security-email">
        <LoadingValue />
      </p>
      <LoadingContent label="Checking your session…">
        <div className="component-grid">
          <section className="component-card">
            <h2>Change password</h2>
            <p className="hint">
              Use at least 12 characters. Changing your password signs out every
              other session.
            </p>
            <form>
              {["Current password", "New password", "Confirm new password"].map(
                (label) => (
                  <Field
                    key={label}
                    label={label}
                    type="password"
                    required
                    readOnly
                  />
                ),
              )}
              <Button>Change password</Button>
            </form>
          </section>
          <section className="component-card">
            <h2>Change email</h2>
            <p className="hint">
              Keep access to both addresses. The change requires approval from
              your current email and verification of the new email.
            </p>
            <form>
              <Field label="New email address" type="email" required readOnly />
              <Button>Request email change</Button>
            </form>
          </section>
        </div>
        <section className="directory">
          <h2>Active sessions</h2>
          <p className="hint">
            Browser details are reported by the device and may not uniquely
            identify it.
          </p>
          <LoadingValue />
        </section>
        <section className="directory danger-section">
          <h2>Delete account</h2>
          <LoadingValue />
        </section>
      </LoadingContent>
    </section>
  );
}
