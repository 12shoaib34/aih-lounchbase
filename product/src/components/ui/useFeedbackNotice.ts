import { useEffect, useId, type RefObject } from "react";

export type Notice = { owner: string; message: string; error: boolean };
let current: Notice | null = null;
const listeners = new Set<() => void>();
export function publish(notice: Notice | null) {
  current = notice;
  listeners.forEach((listener) => listener());
}
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Mirror an inline result visually; its original live region owns announcements. */
export function useFeedbackNotice(
  message: string,
  error = false,
  anchor?: RefObject<HTMLElement | null>,
) {
  const owner = useId();
  useEffect(() => {
    if (!message || anchor?.current?.closest("dialog")) return;
    const notice = { owner, message, error };
    publish(notice);
    return () => {
      if (current === notice) publish(null);
    };
  }, [message, error, owner, anchor]);
}

export const getNotice = () => current;
