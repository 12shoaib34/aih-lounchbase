import Link from "next/link";
export default function Footer() {
  return (
    <footer className={"wrap site-footer op-footer"}>
      <Link className={"logo"} href={"/#home"} aria-label={"AppsInHours home"}>
        <span className={"brand-art"} aria-hidden={"true"}>
          <img
            className={"brand-on-dark"}
            src={"/site/brand-wordmark-dark.svg"}
            alt={""}
            width={"1040"}
            height={"200"}
          />
          <img
            className={"brand-on-light"}
            src={"/site/brand-wordmark-light.svg"}
            alt={""}
            width={"1040"}
            height={"200"}
          />
          <img
            className={"brand-on-print"}
            src={"/site/brand-wordmark-black.svg"}
            alt={""}
            width={"1040"}
            height={"200"}
          />
        </span>
      </Link>
      <div className={"footer-links"}>
        <Link href={"/#about"}>Why us</Link>
        <Link href={"/#work"}>Work</Link>
        <Link href="/services">Services</Link>
        <Link href={"/#process"}>Process</Link>
        <Link href={"/#pricing"}>Pricing</Link>
        <Link href={"/#faq"}>FAQ</Link>
        <Link href={"/#contact"}>Discuss your project</Link>
        <Link href={"/#ventures"}>MVP partnership</Link>
        <Link href={"/ventures"}>Venture terms</Link>
        <Link href={"/blog"}>Insights</Link>
        <Link href={"/privacy"}>Privacy</Link>
        <Link href="/app/account">Account</Link>
      </div>
      <span>© 2026 AppsInHours</span>
      <Link className={"op-back-top"} href={"/#home"}>
        BACK TO TOP ↑
      </Link>

    </footer>
  );
}
