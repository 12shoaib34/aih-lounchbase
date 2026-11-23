"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Footer from "./footer";
import { createScope } from "./behavior/scope";

const classes: Record<string, string> = {
  services: "detail-page services-page",
  engagements: "detail-page engagements-page",
  privacy: "detail-page privacy-page",
  contact: "detail-page contact-page",
  work: "work-page",
  studio: "studio-page",
  ventures: "venture-page",
};
const pages = {
  work: () => import("./behavior/work"),
  studio: () => import("./behavior/studio"),
  ventures: () => import("./behavior/ventures"),
  services: () => import("./behavior/detail"),
  engagements: () => import("./behavior/detail"),
  contact: () => import("./behavior/detail"),
  privacy: () => import("./behavior/detail"),
};
const links = [
  ["about", "Why us"],
  ["work", "Work"],
  ["process", "Process"],
  ["ventures", "MVP partnership"],
  ["pricing", "Pricing"],
  ["faq", "FAQ"],
  ["contact", "Discuss your project ↗"],
];
function Header({ home }: { home: boolean }) {
  const [open, setOpen] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const [compact, setCompact] = useState(false);
  const [light,setLight]=useState(false);
  useEffect(()=>{
    let saved: string | null=null;
    try { saved=localStorage.getItem("aih-theme"); } catch {}
    const initial=saved==="light" || (saved!=="dark" && matchMedia("(prefers-color-scheme: light)").matches);
    document.documentElement.dataset.theme=initial?"light":"dark";
    setLight(initial);
  },[]);
  function toggleTheme(){
    const next=light?"dark":"light";
    document.documentElement.dataset.theme=next;
    try { localStorage.setItem("aih-theme",next); } catch {}
    setLight(!light);
  }
  const menu = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = matchMedia("(max-width:1199px)");
    const sync = () => {
      setCompact(media.matches);
      setOpen(false);
    };
    sync();
    setEnhanced(true);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menu.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  const nav = (
    <nav
      id="main-navigation"
      aria-label="Main navigation"
      inert={enhanced && compact && !open}
      className={open ? "open" : ""}
      onClick={() => setOpen(false)}
    >
      {links.map(([id, label]) => {
        const cls =
          id === "ventures"
            ? "nav-partnership"
            : id === "contact"
              ? "nav-cta"
              : undefined;
        return home ? (
          <a key={id} className={cls} href={"#" + id}>
            {label}
          </a>
        ) : (
          <Link key={id} className={cls} href={"/#" + id}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
  return (
    <header className={enhanced ? "enhanced" : ""}>
      <Link className="logo" href="/#home" aria-label="AppsInHours home">
        <span className="brand-art" aria-hidden="true">
          {["dark", "light", "print"].map((t) => (
            <img
              key={t}
              className={"brand-on-" + t}
              src={
                "/site/brand-wordmark-" +
                (t === "dark" ? "dark" : t === "print" ? "black" : "light") +
                ".svg"
              }
              width="1040"
              height="200"
              alt=""
            />
          ))}
        </span>
      </Link>
      {!compact && nav}
      <button className="theme-toggle" onClick={toggleTheme} aria-label={light?"Switch to dark mode":"Switch to light mode"}>
        {light?"◐":"☼"}
      </button>
      <button
        ref={menu}
        className="menu"
        aria-controls="main-navigation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Close −" : "Menu +"}
      </button>
      {compact && nav}
    </header>
  );
}
export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname(),
    slug = path.slice(1),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scope = createScope(root.current);
    if (!root.current || location.hash) return () => scope.close();
    let mounting = true;
    import("./behavior/opening-loader").then(({ default: mount }) => {
      if (mounting) mount(scope);
    });
    return () => {
      mounting = false;
      scope.close();
    };
  }, []);
  useEffect(() => {
    const scope = createScope(root.current);
    async function enhance() {
      const mounts = [await import("./behavior/experience")];
      if (!slug)
        mounts.push(
          await import("./behavior/onepage"),
          await import("./behavior/hero-grid"),
          await import("./behavior/scene"),
        );
      if (slug in pages) mounts.push(await pages[slug as keyof typeof pages]());
      if (slug === "work") mounts.push(await import("./behavior/projects"));
      if (!slug || slug === "contact")
        mounts.push(
          await import("./behavior/brief-context"),
          await import("./behavior/contact"),
        );
      if (scope.active) {
        for (const module of mounts) module.default(scope);
        if (location.hash)
          document.getElementById(location.hash.slice(1))?.scrollIntoView();
      }
    }
    void enhance();
    return () => scope.close();
  }, [slug]);
  return (
    <div
      ref={root}
      className={
        "site-shell ui-system marketing onepage " + (classes[slug] ?? "")
      }
    >
      <div className="opening-loader">
        <div className="opening-loader__panel" aria-hidden="true" />
        <div className="opening-loader__panel" aria-hidden="true" />
        <div className="opening-loader__brand" role="status">
          <img
            className="opening-loader__dark"
            src="/site/brand-wordmark-dark.svg"
            width="1040"
            height="200"
            alt=""
          />
          <img
            className="opening-loader__light"
            src="/site/brand-wordmark-light.svg"
            width="1040"
            height="200"
            alt=""
          />
          <span className="opening-loader__line" />
          <span className="opening-loader__label">Loading page</span>
        </div>
        <button
          className="opening-loader__skip"
          data-opening-skip
          type="button"
        >
          Skip intro
        </button>
      </div>
      <a className="skip" href="#main">Skip to content</a>
      <Header home={!slug} />
      {children}
      <Footer />
    </div>
  );
}
