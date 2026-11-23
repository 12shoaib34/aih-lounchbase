import { useFeedbackNotice } from "./useFeedbackNotice";
import { useEffect, useRef } from "react";

/** A stable result target after a submitted action; keep it inside an active dialog. */
export function FormFeedback({
  message,
  error = false,
  focus = true,
}: {
  message: string;
  error?: boolean;
  focus?: boolean;
}) {
  const result = useRef<HTMLParagraphElement>(null);
  useFeedbackNotice(message, error, result);
  useEffect(() => {
    if (message && focus) result.current?.focus();
  }, [message, focus]);
  if (!message) return null;
  return (
    <p
      className={`form-feedback${error ? " form-feedback-error" : ""}`}
      ref={result}
      tabIndex={-1}
      role={error ? "alert" : "status"}
      aria-atomic="true"
    >
      {message}
    </p>
  );
}
