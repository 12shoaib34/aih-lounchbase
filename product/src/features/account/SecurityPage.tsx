import { SecuritySkeleton } from "./SecuritySkeleton";
import { PageLoading } from "@/components/ui/PageLoading";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Dialog } from "@/components/ui/Dialog";
import { accessSchema } from "../../../shared/access";

const sessionsSchema = z.array(
  z.object({
    id: z.string(),
    token: z.string(),
    createdAt: z.string(),
    expiresAt: z.string(),
    userAgent: z.string().nullish(),
  }),
);

function deviceLabel(agent: string | null | undefined) {
  if (!agent) return "Browser details unavailable";
  const browser = /Edg(?:e|A|iOS)?\//.test(agent)
    ? "Edge"
    : /OPR\//.test(agent)
      ? "Opera"
      : /Firefox\/|FxiOS\//.test(agent)
        ? "Firefox"
        : /Chrome\/|CriOS\//.test(agent)
          ? "Chrome"
          : /Safari\//.test(agent)
            ? "Safari"
            : "Unknown browser";
  const platform = /iPhone|iPad|iPod/.test(agent)
    ? "iOS"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Macintosh|Mac OS X/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "an unknown device";
  return `${browser} on ${platform}`;
}

export function SecurityPage() {
  const { data, isPending, error, refetch } = authClient.useSession();
  if (isPending) return <SecuritySkeleton />;
  if (error)
    return (
      <section className="panel">
        <h1>Account security</h1>
        <p role="alert">Your session could not be checked.</p>
        <Button onClick={() => void refetch()}>Try again</Button>
        <p>
          <Link to="/account">Go to account access</Link>
        </p>
      </section>
    );
  if (!data)
    return (
      <section className="panel">
        <h1>Account security</h1>
        <p>Sign in to manage your account security.</p>
        <Link to="/account">Sign in</Link>
      </section>
    );
  return (
    <SecurityControls
      key={data.user.id}
      userId={data.user.id}
      email={data.user.email}
      currentSessionId={data.session.id}
      refresh={async () => {
        await refetch();
      }}
    />
  );
}

function SecurityControls({
  userId,
  email,
  currentSessionId,
  refresh,
}: {
  userId: string;
  email: string;
  currentSessionId: string;
  refresh: () => Promise<void>;
}) {
  const cache = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const access = useQuery({
    queryKey: ["security", userId, "access"],
    retry: false,
    queryFn: ({ signal }) => apiRequest("/access", { signal }, accessSchema),
  });
  const sessions = useQuery({
    queryKey: ["security", userId, "sessions"],
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest("/auth/list-sessions", { signal }, sessionsSchema),
  });
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["security", userId] });
    },
    [cache, userId],
  );
  async function action(
    run: () => Promise<{ error: { message?: string } | null }>,
    success: string,
  ) {
    if (pending) return false;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const result = await run();
      if (result.error)
        throw new Error(
          result.error.message || "Request failed. Sign in again and retry.",
        );
      await refresh();
      await cache.invalidateQueries({ queryKey: ["security", userId] });
      setMessage(success);
      return true;
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Request failed. Please try again.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("The new passwords must match.");
      setMessage("");
      return;
    }
    if (
      await action(
        () =>
          authClient.changePassword({
            currentPassword: String(data.get("currentPassword")),
            newPassword: String(data.get("newPassword")),
            revokeOtherSessions: true,
          }),
        "Password updated. Your other sessions have been signed out.",
      )
    )
      form.reset();
  }
  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (
      await action(
        () =>
          authClient.changeEmail({
            newEmail: String(data.get("email")).trim(),
            callbackURL: `${location.origin}/app/account/security`,
          }),
        "If the address is available, an approval link will arrive at your current email. Approve it, then verify the new address while signed in.",
      )
    )
      form.reset();
  }
  return (
    <section className="component-page security-page">
      <p className="eyebrow">Your account</p>
      <h1>Account security</h1>
      <p className="lede security-email">Signed in as {email}</p>
      <Link to="/account">Back to profile</Link>
      {pending && !deleting && <p role="status">Updating account security…</p>}
      <FormFeedback message={message} focus={!deleting} />
      {!deleting && <FormFeedback message={error} error />}
      <div className="component-grid">
        <section className="component-card">
          <h2>Change password</h2>
          <p id="password-requirements" className="hint">
            Use at least 12 characters. Changing your password signs out every
            other session.
          </p>
          <form onSubmit={password}>
            <Field
              disabled={pending}
              label="Current password"
              name="currentPassword"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
            />
            <Field
              disabled={pending}
              label="New password"
              name="newPassword"
              aria-describedby="password-requirements"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <Field
              disabled={pending}
              label="Confirm new password"
              name="confirmPassword"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={pending}>
              Change password
            </Button>
          </form>
        </section>
        <section className="component-card">
          <h2>Change email</h2>
          <p className="hint">
            Keep access to both addresses. The change requires approval from
            your current email and verification of the new email.
          </p>
          <form onSubmit={changeEmail}>
            <Field
              disabled={pending}
              label="New email address"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
            <Button type="submit" disabled={pending}>
              Request email change
            </Button>
          </form>
        </section>
      </div>
      <section className="directory" aria-labelledby="sessions-title">
        <h2 id="sessions-title">Active sessions</h2>
        <p className="hint">
          Browser details are reported by the device and may not uniquely
          identify it.
        </p>
        {sessions.isPending ? (
          <PageLoading label="Loading sessions…" layout="inline" />
        ) : sessions.isError ? (
          <div role="alert">
            <p>
              Sessions could not be loaded. Sign in again if your session has
              expired.
            </p>
            <Button onClick={() => void sessions.refetch()}>
              Reload sessions
            </Button>
          </div>
        ) : (
          <>
            <ul className="session-list">
              {sessions.data.map((session) => (
                <li key={session.id}>
                  <div>
                    <strong>
                      {session.id === currentSessionId
                        ? "This session"
                        : "Other session"}
                    </strong>
                    <p className="session-agent">
                      {deviceLabel(session.userAgent)}
                    </p>
                    <p>
                      Started {new Date(session.createdAt).toLocaleString()} ·
                      Expires {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  {session.id !== currentSessionId && (
                    <Button
                      disabled={pending}
                      onClick={() =>
                        void action(
                          () =>
                            authClient.revokeSession({ token: session.token }),
                          "Session signed out.",
                        )
                      }
                    >
                      Sign out session
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Button
              disabled={
                pending ||
                !sessions.data.some(
                  (session) => session.id !== currentSessionId,
                )
              }
              onClick={() =>
                void action(
                  () => authClient.revokeOtherSessions(),
                  "All other sessions signed out.",
                )
              }
            >
              Sign out all other sessions
            </Button>
          </>
        )}
      </section>
      <section className="directory danger-section">
        <h2>Delete account</h2>
        <p>
          Deleting your account permanently removes your profile, reference
          records, and team membership from this installation.
        </p>
        {access.isPending ? (
          <PageLoading label="Checking account ownership…" layout="inline" />
        ) : access.isError ? (
          <p role="alert">
            Ownership could not be checked. Reload before requesting deletion.
          </p>
        ) : access.data.teamRole === "owner" ? (
          <p>
            The owner account cannot be deleted. Contact the deployment operator
            about ownership transfer.
          </p>
        ) : (
          <>
            <p>
              You will receive an email confirmation link valid for one hour.
              Stay signed in when opening it.
            </p>
            <Button
              disabled={pending}
              onClick={() => {
                setError("");
                setConfirmEmail("");
                setDeleting(true);
              }}
            >
              Request account deletion
            </Button>
          </>
        )}
      </section>
      <Dialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Confirm deletion request"
        actions={
          <>
            {" "}
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() => setDeleting(false)}
            >
              Close
            </Button>
            <Button
              disabled={
                pending ||
                confirmEmail.trim().toLowerCase() !== email.toLowerCase()
              }
              onClick={async () => {
                if (
                  await action(
                    () =>
                      authClient.deleteUser({
                        callbackURL: `${location.origin}/app/account?deleted=1`,
                      }),
                    "Check your email to confirm account deletion. The link expires in one hour.",
                  )
                )
                  setDeleting(false);
              }}
            >
              {pending ? "Sending…" : "Send deletion link"}
            </Button>
          </>
        }
      >
        <p>
          Type your current email to request a deletion link. Opening the
          emailed link while signed in permanently deletes this account and its
          application data.
        </p>
        <Field
          disabled={pending}
          label="Confirm your email"
          type="email"
          value={confirmEmail}
          onChange={(event) => setConfirmEmail(event.target.value)}
          autoComplete="off"
        />
        <FormFeedback message={deleting ? error : ""} error />
      </Dialog>
    </section>
  );
}
