"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@/navigation";
import { z } from "zod";
import { apiRequest } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextAreaField } from "@/components/ui/TextAreaField";
import { FormFeedback } from "@/components/ui/FormFeedback";
import { UnsavedChanges } from "@/components/ui/UnsavedChanges";
import { inquiryQuestions } from "../../../shared/inquiries";

export default function InquiryForm() {
  const [id] = useState(() => crypto.randomUUID());
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [received, setReceived] = useState(false);
  const [error, setError] = useState("");
  const confirmation = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (received) confirmation.current?.focus();
  }, [received]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const answers = Object.fromEntries(
      inquiryQuestions.map((q) => [q.key, form.get("question-" + q.key)]),
    );
    setPending(true);
    setError("");
    try {
      await apiRequest(
        "/inquiries",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            name: form.get("name"),
            email: form.get("email"),
            phone: form.get("phone"),
            website: form.get("website"),
            answers,
          }),
        },
        z.object({ received: z.literal(true) }),
      );
      setReceived(true);
      setDirty(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your inquiry could not be sent. Please retry.",
      );
    } finally {
      setPending(false);
    }
  }
  if (received)
    return (
      <section className="panel">
        <h1 ref={confirmation} tabIndex={-1}>
          Inquiry received
        </h1>
        <p>Your request has been sent to the team. Check your email for your tracking link.</p>
        <p>Reference: {id}</p>
        <Link to="/account/enquiries">My enquiries</Link>
        <Link to="/">Return to the website</Link>
      </section>
    );
  return (
    <section className="panel inquiry-form">
      <h1>Send an inquiry</h1>
      <p>Tell us what you need and how we can reach you.</p>
      <form onSubmit={submit} onChange={() => setDirty(true)}>
        <fieldset disabled={pending}>
          <Field
            label="Name"
            name="name"
            autoComplete="name"
            required
            maxLength={120}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
          />
          <Field
            label="Phone (optional)"
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
          />
          {inquiryQuestions.map((q) => (
            <TextAreaField
              key={q.key}
              label={q.label + (q.required ? "" : " (optional)")}
              name={"question-" + q.key}
              required={q.required}
              maxLength={880}
              rows={4}
            />
          ))}
          <div className="inquiry-trap" aria-hidden="true">
            <label>
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <Button type="submit">{pending ? "Sending…" : "Send inquiry"}</Button>
        </fieldset>
        <FormFeedback message={error} error />
      </form>
      <UnsavedChanges
        dirty={dirty}
        pending={pending}
        pendingMessage="Wait for your inquiry to finish sending."
      />
    </section>
  );
}
