import { useConfirmation } from "@/components/ui/useConfirmation";
import { SecuritySkeleton } from "./SecuritySkeleton";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth";
import { apiRequest, ApiError } from "@/api/client";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function TwoFactorPage() {
  const confirmation = useConfirmation();
  const session = authClient.useSession();
  const [useRecovery, setUseRecovery] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [enrollment, setEnrollment] = useState<{
    totpURI: string;
    backupCodes: string[];
  } | null>(null);
  const setupHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (enrollment) setupHeading.current?.focus();
  }, [enrollment]);
  const [codes, setCodes] = useState<string[]>([]);
  if (session.isPending) return <SecuritySkeleton twoFactor />;
  if (!session.data)
    return (
      <>
        <h1>Two-factor authentication</h1>
        <p>Sign in to manage your authenticator.</p>
        <Link to="/account">Sign in</Link>
      </>
    );
  const enabled = session.data.user.twoFactorEnabled === true;
  return (
    <section className="panel">
      <h1>Two-factor authentication</h1>
      <p>
        Add an authenticator app and keep recovery codes somewhere private.
        Administrators may need to verify a code for their current session
        before accessing business tools.
      </p>
      <p>
        Enabling or disabling two-factor authentication signs out existing
        sessions. This browser receives a replacement session when the change
        succeeds.
      </p>
      <p>Status: {enabled ? "Enabled" : "Not enabled"}</p>
      <FormFeedback message={error} error />
      <FormFeedback message={message} />
      {!enrollment && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (pending) return;
            const password = String(new FormData(form).get("password") ?? "");
            setPending(true);
            setError("");
            setMessage("");
            try {
              if (enabled) {
                await apiRequest("/auth/two-factor/disable", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                setCodes([]);
                setMessage("Two-factor authentication disabled.");
              } else {
                const result = await apiRequest(
                  "/auth/two-factor/enable",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password, method: "totp" }),
                  },
                  z.object({
                    totpURI: z.string(),
                    backupCodes: z.array(z.string()),
                  }),
                );
                setEnrollment(result);
                setCodes(result.backupCodes);
              }
              form.reset();
              await session.refetch();
            } catch (failure) {
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Could not update two-factor authentication.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field
            disabled={pending}
            label="Current password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" disabled={pending}>
            {pending
              ? "Updating…"
              : enabled
                ? "Disable two-factor authentication"
                : "Set up authenticator"}
          </Button>
        </form>
      )}
      {enrollment && (
        <>
          <h2 ref={setupHeading} tabIndex={-1}>
            Connect your authenticator
          </h2>
          <p>
            Use the setup key below in your authenticator app (time-based
            codes), then enter its code to complete enrollment. Keep this key
            private.
          </p>
          <code
            style={{ overflowWrap: "anywhere" }}
            aria-label="Authenticator setup key"
          >
            {new URL(enrollment.totpURI).searchParams.get("secret")}
          </code>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (pending) return;
              const code = String(
                new FormData(event.currentTarget).get("code") ?? "",
              );
              setPending(true);
              setError("");
              try {
                const result = await authClient.twoFactor.verifyTotp({
                  code,
                  trustDevice: false,
                });
                if (result.error) throw new Error();
                setEnrollment(null);
                setMessage(
                  "Two-factor authentication enabled. Save your recovery codes.",
                );
                await session.refetch();
              } catch {
                setError(
                  "The code could not be verified. Check your authenticator and device time.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <Field
              disabled={pending}
              label="Authenticator code"
              name="code"
              required
              pattern="[0-9]{6}"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Confirming…" : "Confirm authenticator"}
            </Button>
          </form>
        </>
      )}
      {enabled && !enrollment && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (pending) return;
            const code = String(
              new FormData(form).get("verificationCode") ?? "",
            );
            setPending(true);
            setMessage("");
            setError("");
            try {
              await apiRequest(
                `/auth/two-factor/${useRecovery ? "verify-backup-code" : "verify-totp"}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ code, trustDevice: false }),
                },
              );
              form.reset();
              setMessage(
                "Code verified for this session. You can return to administration.",
              );
            } catch (failure) {
              setError(
                failure instanceof ApiError
                  ? failure.message
                  : "Code verification failed. Try again.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <h2>Verify this session</h2>
          <Field
            disabled={pending}
            label={
              useRecovery
                ? "Recovery code for this session"
                : "Authenticator code for this session"
            }
            name="verificationCode"
            required
            autoComplete="one-time-code"
          />
          <Button disabled={pending} type="submit">
            {pending ? "Verifying…" : "Verify this session"}
          </Button>
          <Button
            disabled={pending}
            variant="secondary"
            onClick={() => setUseRecovery((value) => !value)}
          >
            {useRecovery
              ? "Use authenticator for this session"
              : "Use recovery code for this session"}
          </Button>
          <Link to="/admin">Return to administration</Link>
        </form>
      )}
      {!!codes.length && (
        <section className="component-card">
          <h2>Recovery codes</h2>
          <p>
            Each code works once. Save these securely before leaving. They are
            not saved in this browser.
          </p>
          <ul>
            {codes.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={() => setCodes([])}>
            I saved my recovery codes
          </Button>
        </section>
      )}
      {enabled && !enrollment && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            if (pending) return;
            if (
              !(await confirmation.confirm(
                "Replace all previous recovery codes?",
                {
                  title: "Replace recovery codes?",
                  confirmLabel: "Replace codes",
                },
              ))
            )
              return;
            const password = String(new FormData(form).get("password") ?? "");
            setPending(true);
            setError("");
            try {
              const result = await authClient.twoFactor.generateBackupCodes({
                password,
              });
              if (result.error || !result.data) throw new Error();
              setCodes(result.data.backupCodes);
              form.reset();
            } catch {
              setError(
                "Could not replace recovery codes. Check your password.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field
            disabled={pending}
            label="Password to replace recovery codes"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Replacing…" : "Replace recovery codes"}
          </Button>
        </form>
      )}
      <Link to="/account">Back to my account</Link>
    </section>
  );
}
