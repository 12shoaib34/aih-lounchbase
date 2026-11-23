import { FormFeedback } from "@/components/ui/FormFeedback";
import { useEffect, useState } from "react";
import { Link } from "@/navigation";
import { z } from "zod";
import { apiRequest, ApiError } from "@/api/client";
import { Button } from "@/components/ui/Button";

export function InvitePage() {
  const [token, setToken] = useState("");
  useEffect(() => setToken(location.hash.slice(1)), []);
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <section className="panel">
      <p className="eyebrow">Team invitation</p>
      <h1>{joined ? "You joined the team" : "Join your team"}</h1>
      {joined ? (
        <Link to="/admin">Open administration</Link>
      ) : (
        <>
          <p>
            Sign in with the email address that received this invitation. If you
            are new, create and verify your account first.
          </p>
          <p>
            <Link to="/account" target="_blank" rel="noopener noreferrer">
              Sign in or create an account (new tab)
            </Link>
          </p>
          <p>Then return here to accept your invitation.</p>
          <Button
            disabled={pending || !/^[a-f0-9]{64}$/.test(token)}
            onClick={async () => {
              setPending(true);
              setMessage("");
              try {
                await apiRequest(
                  "/team/accept",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                  },
                  z.object({ success: z.literal(true) }),
                );
                history.replaceState(history.state, "", "/app/invite");
                setJoined(true);
              } catch (error) {
                setMessage(
                  error instanceof ApiError
                    ? error.message
                    : "We could not accept this invitation. Please try again.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Joining…" : "Accept invitation"}
          </Button>
          {!/^[a-f0-9]{64}$/.test(token) && (
            <p role="alert">
              Open the complete invitation link from your email.
            </p>
          )}
        </>
      )}
      <FormFeedback message={message} error />
      <FormFeedback message={joined ? "You joined the team." : ""} />
    </section>
  );
}
