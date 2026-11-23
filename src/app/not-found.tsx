import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: { absolute: "Page Not Found | AppsInHours" },
  robots: { index: false },
};

export default function NotFound() {
  return (
    <>
      <link rel="icon" href="/site/favicon.svg" type="image/svg+xml" />
      <link rel="stylesheet" href="/site/style.css" precedence="default" />
      <link rel="stylesheet" href="/site/refinement.css" precedence="default" />
      <link rel="stylesheet" href="/site/brand.css" precedence="default" />
      <main id="main" className="wrap">
        <section className="hero">
          <Link className="logo error-brand" href="/" aria-label="AppsInHours home"><img src="/site/brand-wordmark-dark.svg" width="192" alt="" /></Link>
          <div className="eyebrow">404 / PAGE NOT FOUND</div>
          <h1>
            This path ends here.
            <br />
            Your next step doesn’t.
          </h1>
          <p>The page may have moved, or the address may be incomplete.</p>
          <div className="hero-buttons">
            <Link className="primary-link" href="/">
              Back to AppsInHours ↗
            </Link>
            <Link href="/contact">Discuss your project ↗</Link>
          </div>
        </section>
      </main>
    </>
  );
}
