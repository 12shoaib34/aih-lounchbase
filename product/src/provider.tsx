"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authClient } from "./lib/auth";
import { ConfirmationProvider } from "./components/ui/ConfirmationProvider";
import { FeedbackNoticeHost } from "./components/ui/FeedbackNotice";

import { usePathname } from "next/navigation";
function RouteFocus() {
  const path = usePathname(),
    prev = useRef(path);
  useEffect(() => {
    if (prev.current !== path)
      document
        .querySelector<HTMLElement>(".launchbase main")
        ?.focus({ preventScroll: true });
    prev.current = path;
  }, [path]);
  return null;
}
function SessionCache({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: 0 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConfirmationProvider>{children}</ConfirmationProvider>
      <FeedbackNoticeHost />
    </QueryClientProvider>
  );
}
export default function ProductProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const [settled, setSettled] = useState(!session.isPending);
  if (!settled && !session.isPending) setSettled(true);
  if (!settled && session.isPending && !session.data)
    return (
      <div className="launchbase">
        <p role="status">Loading account access…</p>
      </div>
    );
  return (
    <div className="launchbase">
      <Suspense fallback={<p role="status">Loading workspace…</p>}>
        <RouteFocus />
        <SessionCache key={session.data?.user.id ?? "guest"}>
          {children}
        </SessionCache>
      </Suspense>
    </div>
  );
}
