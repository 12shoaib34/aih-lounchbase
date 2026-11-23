import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "@/navigation";
import { NavigationIcon } from "./NavigationIcon";
import { WorkspaceBreadcrumbContext } from "./WorkspaceBreadcrumbContext";
import { WorkspaceMenu } from "./WorkspaceMenu";
import { authClient } from "@/lib/auth";
import { useUiStore, type WorkspaceLink } from "@/stores/useUiStore";
import { product } from "../../lib/product";

type WorkspaceShellProps = {
  title: string;
  context: string;
  links: readonly WorkspaceLink[];
  children: ReactNode;
  breadcrumbs?: ReactNode;
  navigationLoading?: boolean;
  routeLoading?: boolean;
};

/** Presentation only. Protected pages and APIs must enforce access separately. */
export function WorkspaceShell({
  title,
  context,
  links,
  children,
  breadcrumbs,
  navigationLoading = false,
  routeLoading = false,
}: WorkspaceShellProps) {
  const [breadcrumbTarget, setBreadcrumbTarget] =
    useState<HTMLDivElement | null>(null);
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const snapshot = useUiStore((state) => state.navigation);
  const rememberNavigation = useUiStore((state) => state.rememberNavigation);
  const rememberedLinks =
    snapshot?.userId === userId && snapshot?.context === title
      ? snapshot.links
      : undefined;
  const visibleLinks =
    navigationLoading && rememberedLinks ? rememberedLinks : links;
  const showNavigationSkeleton = navigationLoading && !rememberedLinks;
  useEffect(() => {
    if (!userId) {
      rememberNavigation(null);
      return;
    }
    if (!navigationLoading)
      rememberNavigation({ userId, context: title, links });
  }, [userId, title, links, navigationLoading, rememberNavigation]);
  const [tooltip, setTooltip] = useState<{ label: string; top: number } | null>(
    null,
  );
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggle = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);
  const content = useRef<HTMLElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);
  const location = useLocation();
  const [navigationKey, setNavigationKey] = useState<string | null>(null);
  const navigationOpen = navigationKey === location.key;
  const setNavigationOpen = (open: boolean) =>
    setNavigationKey(open ? location.key : null);
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const measure = () =>
      element.parentElement?.style.setProperty(
        "--workspace-header-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const dialog = drawer.current;
    if (navigationOpen && dialog && !dialog.open) dialog.showModal();
    if (!navigationOpen && dialog?.open) dialog.close();
  }, [navigationOpen]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => {
      if (desktop.matches) {
        drawer.current?.close();
        setNavigationKey(null);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const keepFocusedTooltip = (sidebar: HTMLElement) => {
    const active =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>("[data-tooltip]")
        : null;
    if (collapsed && active && sidebar.contains(active)) {
      setTooltip({
        label: active.dataset.tooltip!,
        top: active.getBoundingClientRect().top + active.offsetHeight / 2,
      });
    } else setTooltip(null);
  };
  const navigation = (
    <>
      <nav aria-label={`${title} navigation`}>
        {visibleLinks.map((link, index) => (
          <Fragment key={link.to}>
            {link.group && link.group !== visibleLinks[index - 1]?.group && (
              <p className="navigation-group-label">{link.group}</p>
            )}
            <NavLink
              data-tooltip={link.label}
              aria-label={link.label}
              to={link.to}
              end={link.end}
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                drawer.current?.close();
                setNavigationOpen(false);
                content.current?.focus({ preventScroll: true });
              }}
            >
              <NavigationIcon to={link.to} />
              <span className="navigation-text">{link.label}</span>
            </NavLink>
          </Fragment>
        ))}
        {showNavigationSkeleton && (
          <div className="navigation-loading" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <span key={index}>
                <i />
                <b />
              </span>
            ))}
          </div>
        )}
      </nav>
      <div className="workspace-sidebar-footer">
        <NavLink to="/" aria-label="Visit website" data-tooltip="Visit website">
          <NavigationIcon to="/website" />
          <span className="navigation-text">Visit website</span>
        </NavLink>
      </div>
    </>
  );
  return (
    <WorkspaceBreadcrumbContext.Provider value={{ target: breadcrumbTarget }}>
      <div
        className="workspace-shell"
        data-sidebar-collapsed={collapsed}
        data-navigation-open={navigationOpen}
      >
        <a className="skip-link" href="#workspace-content">
          Skip to content
        </a>
        <header ref={header} className="workspace-header">
          <NavLink
            className="brand workspace-brand"
            to="/"
            aria-label={product.name}
            title={product.name}
          >
            <span className="workspace-brand-mark" aria-hidden="true">
              {product.name.trim().charAt(0)}
            </span>
            <span className="workspace-brand-name">{product.name}</span>
          </NavLink>
          <span className="sr-only">{context}</span>
          <button
            ref={toggle}
            disabled={routeLoading}
            className="navigation-toggle"
            type="button"
            aria-expanded={navigationOpen}
            aria-controls="workspace-navigation-drawer"
            onClick={() => setNavigationOpen(!navigationOpen)}
          >
            <NavigationIcon to="/menu" />
            <span className="sr-only">Navigation</span>
          </button>
          <div className="workspace-breadcrumb-slot" ref={setBreadcrumbTarget}>
            <div className="workspace-breadcrumb-fallback">{breadcrumbs}</div>
          </div>
          <WorkspaceMenu />
        </header>
        <aside
          className="workspace-sidebar"
          tabIndex={0}
          aria-label={`${title} sidebar`}
          onScrollCapture={(event) => keepFocusedTooltip(event.currentTarget)}
          onPointerOver={(event) => {
            const target = (event.target as Element).closest<HTMLElement>(
              "[data-tooltip]",
            );
            if (collapsed && target)
              setTooltip({
                label: target.dataset.tooltip!,
                top:
                  target.getBoundingClientRect().top + target.offsetHeight / 2,
              });
          }}
          onPointerLeave={(event) => keepFocusedTooltip(event.currentTarget)}
          onFocus={(event) => {
            const target = event.target.closest<HTMLElement>("[data-tooltip]");
            if (collapsed && target)
              setTooltip({
                label: target.dataset.tooltip!,
                top:
                  target.getBoundingClientRect().top + target.offsetHeight / 2,
              });
          }}
          onBlur={() => setTooltip(null)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setTooltip(null);
          }}
        >
          {!navigationOpen && navigation}
          <button
            className="sidebar-collapse"
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            onClick={() => {
              setTooltip(null);
              toggleSidebar();
            }}
            data-tooltip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <NavigationIcon to={collapsed ? "/expand" : "/collapse"} />
            <span className="navigation-text">Collapse sidebar</span>
          </button>
        </aside>
        <dialog
          ref={drawer}
          id="workspace-navigation-drawer"
          className="workspace-drawer"
          aria-label={`${title} navigation menu`}
          onCancel={(event) => {
            event.preventDefault();
            setNavigationOpen(false);
          }}
          onClose={() => setNavigationOpen(false)}
        >
          <div className="workspace-drawer-heading">
            <h2>{title}</h2>
            <button
              type="button"
              className="navigation-toggle"
              onClick={() => setNavigationOpen(false)}
            >
              Close navigation
            </button>
          </div>
          <div className="workspace-drawer-content">
            {navigationOpen && navigation}
          </div>
        </dialog>
        {collapsed && tooltip && (
          <div
            className="sidebar-tooltip"
            role="tooltip"
            style={{ top: tooltip.top }}
          >
            {tooltip.label}
          </div>
        )}
        <main
          ref={content}
          id="workspace-content"
          data-route-loading={routeLoading || undefined}
          className="workspace-content"
          tabIndex={-1}
        >
          <div className="workspace-content-inner">{children}</div>
        </main>
      </div>
    </WorkspaceBreadcrumbContext.Provider>
  );
}
