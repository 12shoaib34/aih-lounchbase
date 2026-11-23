import NextLink from "next/link";
import {
  usePathname,
  useSearchParams as useNextSearch,
  useRouter,
} from "next/navigation";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";

function productPath(to: string) {
  return to === "/" ? "/" : "/app" + to;
}
export type LinkProps = Omit<ComponentProps<typeof NextLink>, "href"> & {
  to: string;
};
export function Link({ to, ...props }: LinkProps) {
  return <NextLink {...props} href={productPath(to)} />;
}
export function NavLink({ end, to, ...props }: LinkProps & { end?: boolean }) {
  const path = usePathname();
  const href = productPath(to);
  const current = path === href || (!end && path.startsWith(href + "/"));
  return (
    <Link
      {...props}
      to={to}
      className={[props.className, current ? "active" : ""]
        .filter(Boolean)
        .join(" ")}
      aria-current={current ? "page" : undefined}
    />
  );
}
export function useLocation() {
  const path = usePathname();
  const query = useNextSearch().toString();
  return {
    pathname: path.slice(4) || "/",
    search: query ? "?" + query : "",
    key: path + "?" + query,
  };
}
export function useSearchParams() {
  const params = useNextSearch(),
    router = useRouter(),
    path = usePathname();
  return [
    params,
    (next: URLSearchParams) =>
      router.push(path + "?" + next.toString(), { scroll: false }),
  ] as const;
}
export function useBlocker(block: boolean) {
  const router = useRouter();
  const [destination, setDestination] = useState("");
  const historyOffset = useRef(0);
  const replay = useRef(false);
  useLayoutEffect(() => {
    if (!block) return;
    function intercept(event: MouseEvent) {
      if (
        event.button ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.target ||
        link.origin !== location.origin ||
        link.href === location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(link.pathname + link.search + link.hash);
    }
    // Next owns the history entries. Restore the editor entry before asking
    // whether to replay a Back/Forward traversal.
    const nav = (
      window as Window & {
        navigation?: EventTarget & { currentEntry?: { index: number } };
      }
    ).navigation;
    const startIndex = nav?.currentEntry?.index;
    const startURL = location.href,
      startState = history.state;
    let restoring = false;
    function traverse(event: PopStateEvent) {
      if (replay.current) {
        replay.current = false;
        return;
      }
      event.stopImmediatePropagation();
      if (restoring) {
        restoring = false;
        return;
      }
      const target = location.pathname + location.search + location.hash;
      const index = nav?.currentEntry?.index;
      if (
        startIndex !== undefined &&
        index !== undefined &&
        index !== startIndex
      ) {
        historyOffset.current = index - startIndex;
        restoring = true;
        history.go(-historyOffset.current);
      } else {
        history.pushState(startState, "", startURL);
        historyOffset.current = -1;
      }
      setDestination(target);
    }
    function navigate(event: Event) {
      const move = event as Event & {
        navigationType: string;
        destination: { url: string; index: number };
      };
      if (
        move.navigationType !== "traverse" ||
        !move.cancelable ||
        replay.current ||
        restoring
      )
        return;
      move.preventDefault();
      const target = new URL(move.destination.url);
      historyOffset.current =
        startIndex === undefined ? 0 : move.destination.index - startIndex;
      setDestination(target.pathname + target.search + target.hash);
    }
    nav?.addEventListener("navigate", navigate);
    window.addEventListener("popstate", traverse, true);
    function sessionEnd(event: Event) {
      event.preventDefault();
    }
    document.addEventListener("click", intercept, true);
    window.addEventListener("launchbase:before-session-end", sessionEnd);
    return () => {
      nav?.removeEventListener("navigate", navigate);
      window.removeEventListener("popstate", traverse, true);
      document.removeEventListener("click", intercept, true);
      window.removeEventListener("launchbase:before-session-end", sessionEnd);
    };
  }, [block]);
  return {
    state: destination ? "blocked" : "idle",
    reset: () => {
      historyOffset.current = 0;
      setDestination("");
    },
    proceed: () => {
      if (historyOffset.current) {
        replay.current = true;
        history.go(historyOffset.current);
        historyOffset.current = 0;
      } else if (destination) router.push(destination);
      setDestination("");
    },
  };
}
