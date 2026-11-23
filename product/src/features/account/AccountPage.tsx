import { ProfileSkeleton, ProfileDetailsSkeleton } from "./ProfileSkeleton";
import { PageLoading } from "@/components/ui/PageLoading";
import { FormFeedback } from "@/components/ui/FormFeedback";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccountNavigation } from "./AccountNavigation";
import { z } from "zod";
import { authClient } from "@/lib/auth";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { profileInput, profileResponse } from "../../../shared/profile";

export function AccountPage() {
  const session = authClient.useSession();
  const capability = useQuery({
    queryKey: ["capabilities"],
    queryFn: ({ signal }) =>
      apiRequest(
        "/capabilities",
        { signal },
        z.object({ accounts: z.boolean(), signup: z.boolean() }),
      ),
  });
  if (capability.isPending)
    return session.data ? (
      <ProfileSkeleton />
    ) : (
      <PageLoading label="Loading account access…" layout="form" />
    );
  if (capability.isError)
    return (
      <section className="panel">
        <h1>Account access</h1>
        <p role="alert">Account access could not be loaded.</p>
        <Button onClick={() => void capability.refetch()}>Try again</Button>
      </section>
    );
  if (!capability.data.accounts)
    return (
      <section className="panel">
        <h1>Account access</h1>
        <p>Sign-in is not available for this installation.</p>
      </section>
    );
  return <AccountForm signup={capability.data.signup} />;
}

function AccountForm({ signup }: { signup: boolean }) {
  const { data: session, isPending, error, refetch } = authClient.useSession();
  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(
    () =>
      new URLSearchParams(location.search).has("token") ? "reset" : "login",
  );
  const [message, setMessage] = useState(() =>
    new URLSearchParams(location.search).has("error")
      ? "This link is invalid or expired. Request a new email and try again."
      : new URLSearchParams(location.search).has("deleted")
        ? "Your account has been deleted."
        : "",
  );
  const [failure, setFailure] = useState(() =>
    new URLSearchParams(location.search).has("error"),
  );
  const headingView = useRef<string | null>(null);
  const passwordHint = useId();
  const [pending, setPending] = useState(false);
  const [secondFactor, setSecondFactor] = useState(false);
  const [backup, setBackup] = useState(false);
  const cache = useQueryClient();
  const userId = session?.user.id;
  const currentUserId = useRef(userId);
  // A session refresh can temporarily unmount the view. Focus the new heading
  // on subsequent mounts as well as mode changes, but preserve initial-load focus.
  const view = `${userId ?? "guest"}:${mode}:${secondFactor}`;
  const heading = useCallback(
    (node: HTMLHeadingElement | null) => {
      if (!node) return;
      if (headingView.current !== null) node.focus();
      headingView.current = view;
    },
    [view],
  );
  useEffect(() => {
    currentUserId.current = userId;
  }, [userId]);
  useEffect(
    () => () => {
      cache.removeQueries({ queryKey: ["profile", userId], exact: true });
    },
    [cache, userId],
  );
  const profile = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    retry: false,
    queryFn: ({ signal }) =>
      apiRequest("/profile", { signal }, profileResponse),
  });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setFailure(false);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const startedUserId = userId;
    try {
      if (mode === "reset") {
        const token = new URLSearchParams(location.search).get("token") ?? "";
        const result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
        if (result.error) throw new Error();
        history.replaceState(history.state, "", "/app/account");
        setMode("login");
        setMessage("Password updated. Please sign in again.");
        await refetch();
      } else if (userId) {
        const input = profileInput.parse({
          displayName: form.get("displayName"),
        });
        await apiRequest(
          "/profile",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          },
          profileResponse,
        );
        if (currentUserId.current !== startedUserId) return;
        await cache.invalidateQueries({ queryKey: ["profile", userId] });
        setMessage("Your changes have been saved.");
      } else if (mode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${location.origin}/app/account`,
        });
        if (result.error) throw new Error();
        setMessage(
          "If an account matches that address, a recovery email will arrive shortly.",
        );
      } else if (mode === "signup") {
        const result = await authClient.signUp.email({
          name: String(form.get("name")),
          email,
          password,
          callbackURL: `${location.origin}/app/account`,
        });
        if (result.error) throw new Error();
        setMode("login");
        setMessage(
          "Check your email to verify your account before signing in.",
        );
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error();
        if (
          result.data &&
          "twoFactorRedirect" in result.data &&
          result.data.twoFactorRedirect
        )
          setSecondFactor(true);
        setMessage("");
      }
    } catch {
      if (currentUserId.current === startedUserId) {
        setFailure(true);
        setMessage(
          "We could not complete that request. Check your details, verify your email if needed, and try again.",
        );
      }
    } finally {
      setPending(false);
    }
  }
  if (isPending) return <ProfileSkeleton />;
  if (secondFactor && !userId)
    return (
      <section className="panel">
        <h1 ref={heading} tabIndex={-1}>
          Verify your sign-in
        </h1>
        <p>
          {backup
            ? "Enter one unused recovery code."
            : "Enter the six-digit code from your authenticator app."}
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (pending) return;
            setPending(true);
            setMessage("");
            const code = String(
              new FormData(event.currentTarget).get("code") ?? "",
            );
            try {
              const result = backup
                ? await authClient.twoFactor.verifyBackupCode({ code })
                : await authClient.twoFactor.verifyTotp({
                    code,
                    trustDevice: false,
                  });
              if (result.error) throw new Error();
              setSecondFactor(false);
              await refetch();
            } catch {
              setMessage(
                "That code could not be verified. Try again or use a recovery code.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <Field
            disabled={pending}
            label={backup ? "Recovery code" : "Authenticator code"}
            name="code"
            required
            autoComplete="one-time-code"
            inputMode={backup ? "text" : "numeric"}
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Verifying…" : "Verify sign-in"}
          </Button>
        </form>
        <FormFeedback message={message} error />
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setBackup(!backup);
            setMessage("");
          }}
        >
          {backup ? "Use authenticator" : "Use recovery code"}
        </Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            setSecondFactor(false);
            setMessage("");
          }}
        >
          Start again
        </Button>
      </section>
    );
  if (error)
    return (
      <section className="panel">
        <h1>Account access</h1>
        <p role="alert">Your session could not be checked.</p>
        <Button onClick={() => void refetch()}>Try again</Button>
      </section>
    );
  const reset = mode === "reset";
  const title = reset
    ? "Choose a new password"
    : userId
      ? "Profile"
      : mode === "signup"
        ? "Create your account"
        : mode === "forgot"
          ? "Recover your account"
          : "Welcome back";
  return (
    <section className={`panel ${userId && !reset ? "account-profile" : ""}`}>
      <p className="eyebrow">Your account</p>
      <h1 ref={heading} tabIndex={-1}>
        {title}
      </h1>
      {userId && !reset && (
        <p className="lede">
          Manage your personal details, workspace and account security.
        </p>
      )}
      {userId && !reset && profile.isPending ? (
        <ProfileDetailsSkeleton />
      ) : userId && !reset && profile.isError ? (
        <div role="alert">
          <p>We could not load your profile. Your session may have expired.</p>
          <Button
            onClick={() => {
              void refetch();
              void profile.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <form
          className={userId && !reset ? "profile-details" : undefined}
          onSubmit={submit}
          key={`${userId ?? "guest"}-${mode}`}
        >
          {userId && !reset && (
            <div className="profile-section-heading">
              <h2>Personal details</h2>
              <p className="hint">Choose the name displayed on your account.</p>
            </div>
          )}
          {userId && !reset ? (
            <Field
              disabled={pending}
              label="Display name"
              name="displayName"
              defaultValue={profile.data?.displayName}
              required
              maxLength={100}
              autoComplete="name"
            />
          ) : (
            <>
              {mode === "signup" && (
                <Field
                  disabled={pending}
                  label="Name"
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              )}
              {!reset && (
                <Field
                  disabled={pending}
                  label="Email address"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              )}
              {mode !== "forgot" && (
                <Field
                  disabled={pending}
                  label={reset ? "New password" : "Password"}
                  name="password"
                  aria-describedby={
                    reset || mode === "signup" ? passwordHint : undefined
                  }
                  type="password"
                  required
                  minLength={mode === "login" ? undefined : 12}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                />
              )}
              {(reset || mode === "signup") && (
                <p id={passwordHint} className="hint">
                  Use at least 12 characters.
                </p>
              )}
            </>
          )}
          <Button type="submit" disabled={pending}>
            {pending
              ? "Please wait…"
              : reset
                ? "Update password"
                : userId
                  ? "Save changes"
                  : mode === "forgot"
                    ? "Send recovery email"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"}
          </Button>
        </form>
      )}
      <FormFeedback message={message} error={failure} />
      {userId && !reset && <AccountNavigation userId={userId} />}
      <div className="account-actions">
        {userId ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                const result = await authClient.signOut();
                if (result.error) throw new Error();
                cache.removeQueries({ queryKey: ["profile"] });
                setMessage("");
                setMode("login");
              } catch {
                setFailure(true);
                setMessage("Sign-out failed. Please try again.");
              } finally {
                setPending(false);
              }
            }}
          >
            Sign out
          </Button>
        ) : (
          <>
            {mode !== "login" && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  setMode("login");
                  setMessage("");
                  history.replaceState(history.state, "", "/app/account");
                }}
              >
                Back to sign in
              </Button>
            )}
            {mode === "login" && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setMode("forgot");
                    setMessage("");
                  }}
                >
                  Forgot password?
                </Button>
                {signup && (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setMode("signup");
                      setMessage("");
                    }}
                  >
                    Create account
                  </Button>
                )}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}
