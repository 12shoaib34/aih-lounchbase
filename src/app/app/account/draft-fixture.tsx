"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Routing fixture only. Real account and sensitive editor data must have separate storage policies.
const key = "aih:routing-fixture";
export default function DraftFixture() {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  async function saveFixture() {
    setPending(true);
    try {
      const cache = await caches.open(key);
      await cache.put("/app/account/test-draft", new Response(draft));
      update("");
      setStatus("Test draft saved in this browser.");
    } catch {
      setStatus("Save failed. Your draft is available to retry.");
    } finally {
      setPending(false);
    }
  }
  useEffect(() => { setDraft(sessionStorage.getItem(key) ?? ""); }, []);
  useEffect(() => {
    if (!draft) return;
    function warn(event: BeforeUnloadEvent) { event.preventDefault(); event.returnValue = ""; }
    function preventSessionEnd(event: Event) { event.preventDefault(); }
    window.addEventListener("launchbase:before-session-end", preventSessionEnd);
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("launchbase:before-session-end", preventSessionEnd);
    };
  }, [draft]);
  function update(value: string) {
    if (value) sessionStorage.setItem(key, value); else sessionStorage.removeItem(key);
    setDraft(value);
  }
  return <><label>Test draft<textarea disabled={pending} value={draft} onChange={event => update(event.target.value)} /></label>
    <button disabled={!draft || pending} onClick={saveFixture}>Save test draft</button>{" "}
    <span role="status">{status}</span>
    <Link href="/work" onNavigate={event => { if (pending) { event.preventDefault(); setStatus("Wait for the save to finish."); return; } if (draft) { event.preventDefault(); setConfirming(true); } }}>Return to work</Link>
    {confirming && <section aria-label="Unsaved draft"><p>Discard your draft and leave?</p>
      <button autoFocus onClick={() => setConfirming(false)}>Keep editing</button>{" "}
      <button onClick={() => { update(""); router.push("/work"); }}>Discard and leave</button></section>}</>;
}
