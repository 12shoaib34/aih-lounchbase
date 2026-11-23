import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: { absolute: "Page Not Found | AppsInHours" },
  robots: { index: false },
};

export default function BlogNotFound() {
  return (
    <section className="blog-index wrap blog-missing">
      <div className="page-back-row"><Link className="page-back" href="/"><span className="page-back-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="page-back-label">Back</span></Link></div>
      <div className="eyebrow">404 / PAGE NOT FOUND</div>
      <h1>
        We couldn’t find that article.
      </h1>
      <p>The post may have moved, or the address may be incomplete.</p>
      <div className="hero-buttons">
        <Link className="primary-link" href="/blog">
          All posts ↗
        </Link>
        <Link href="/contact">Discuss your project ↗</Link>
      </div>
    </section>
  );
}
