import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  getNotice,
  publish,
  subscribe,
  type Notice,
} from "./useFeedbackNotice";

export function FeedbackNoticeHost() {
  const notice = useSyncExternalStore(subscribe, getNotice, () => null);
  return notice ? (
    <NoticeCard
      key={`${notice.owner}-${notice.message}-${notice.error}`}
      notice={notice}
    />
  ) : null;
}

function NoticeCard({ notice }: { notice: Notice }) {
  const returnFocus = useRef<HTMLElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (!closing) return;
    const delay = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 180;
    const timer = window.setTimeout(() => {
      if (getNotice() === notice) publish(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [closing, notice]);
  useEffect(() => {
    if (focused || closing) return;
    const timer = window.setTimeout(() => {
      setClosing(true);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [notice, focused, closing]);
  return createPortal(
    <aside
      className={`feedback-notice${notice.error ? " feedback-notice-error" : ""}${closing ? " feedback-notice-closing" : ""}`}
      aria-label="Action notification"
      onFocus={(event) => {
        if (
          event.relatedTarget instanceof HTMLElement &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          returnFocus.current = event.relatedTarget;
        setFocused(true);
      }}
      onBlur={() => setFocused(false)}
    >
      <span className="feedback-notice-icon" aria-hidden="true">
        {notice.error ? "!" : "i"}
      </span>
      <div>
        <strong>{notice.error ? "Action needs attention" : "Update"}</strong>
        <p>{notice.message}</p>
      </div>
      <button
        type="button"
        aria-label="Dismiss notification"
        disabled={closing}
        onClick={() => {
          if (returnFocus.current?.isConnected)
            returnFocus.current.focus({ preventScroll: true });
          setClosing(true);
        }}
      >
        ×
      </button>
    </aside>,
    document.querySelector(".launchbase") ?? document.body,
  );
}
