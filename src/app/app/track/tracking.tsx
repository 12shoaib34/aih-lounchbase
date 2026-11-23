"use client";
import { useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/api/client";
import { enquirySummary } from "../../../../product/shared/enquiries";
import type { z } from "zod";

const post = (path: string, body: object) =>
  apiRequest("/tracking/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
export default function Tracking() {
  const [row, setRow] = useState<z.infer<typeof enquirySummary> | null>(null);
  const [reference, setReference] = useState(""),
    [token, setToken] = useState("");
  const [busy, setBusy] = useState(true),
    [message, setMessage] = useState("");
  async function load() {
    try {
      setRow(await apiRequest("/tracking", {}, enquirySummary));
    } catch (e) {
      setRow(null);
      if (!(e instanceof ApiError && e.status === 401)) throw e;
    }
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    function readLink() {
      const url = new URL(location.href);
      setReference(url.searchParams.get("reference") || "");
      if (!url.hash) return false;
      setToken(url.hash.slice(1));
      setRow(null);
      setMessage("");
      setBusy(false);
      history.replaceState(history.state, "", url.pathname + url.search);
      return true;
    }
    if (!readLink()) void act(load);
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);
  return (
    <>
      {token ? (
        <>
          <p>Sign in to view the enquiry linked to this email.</p>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                try {
                  await post("signin", { reference, token });
                  setToken("");
                  await load();
                } catch (e) {
                  if (e instanceof ApiError && [400, 401].includes(e.status))
                    setToken("");
                  throw e;
                }
              })
            }
          >
            Sign in to view status
          </button>
        </>
      ) : row ? (
        <>
          <dl>
            <dt>Reference</dt>
            <dd>{row.id}</dd>
            <dt>Enquiry</dt>
            <dd>{row.service}</dd>
            <dt>Current status</dt>
            <dd>{row.status}</dd>
          </dl>
          <button disabled={busy} onClick={() => void act(load)}>
            Refresh status
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                await post("signout", {});
                setRow(null);
                setMessage("Signed out.");
              })
            }
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p>
            Use the link we emailed you, or request a fresh link using the
            reference from your receipt.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const email = new FormData(e.currentTarget).get("email");
              void act(async () => {
                await post("request", { reference: reference.trim(), email });
                setMessage(
                  "If the details match, we’ll email a link. Please allow a few minutes.",
                );
              });
            }}
          >
            <label>
              Enquiry reference
              <input
                value={reference}
                required
                maxLength={36}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label>
              Email address
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <button disabled={busy}>Email me a sign-in link</button>
          </form>
        </>
      )}
      <p role="status">{busy ? "Please wait…" : message}</p>
    </>
  );
}
