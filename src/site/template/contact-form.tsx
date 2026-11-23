"use client";
import { useEffect, useRef } from "react";
import mount from "../behavior/enquiry";
import { createScope } from "../behavior/scope";
export default function ContactForm({
  services,
  email,
}: {
  services: readonly string[];
  email: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const scope = createScope(form.current);
    mount(scope);
    return () => scope.close();
  }, []);
  return (
    <form ref={form} id="brief" data-contact-email={email}>
      <label>
        Your name
        <input name="name" autoComplete="name" required maxLength={100} />
      </label>
      <label>
        Email address
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        What do you need?
        <select name="service" required>
          {services.map((service) => (
            <option key={service}>{service}</option>
          ))}
        </select>
      </label>
      <label>
        Your enquiry
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
        />
      </label>
      <div hidden>
        <label>
          Leave empty
          <input name="website" autoComplete="off" tabIndex={-1} />
        </label>
      </div>
      <div id="verification" />
      <button type="submit" id="send-enquiry" disabled>
        Send enquiry
      </button>
      <p id="send-status" role="status">
        Online enquiries require JavaScript. You can also email{" "}
        <a href={"mailto:" + email}>{email}</a>.
      </p>
    </form>
  );
}
