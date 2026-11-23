import Link from "next/link";
export function BlogUnavailable() {
  return <section className="wrap blog-index blog-missing">
      <div className="page-back-row"><Link className="page-back" href="/"><span className="page-back-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="page-back-label">Back</span></Link></div>
    <p className="eyebrow">INSIGHTS / TEMPORARILY UNAVAILABLE</p>
    <h1>Our articles are temporarily unavailable.</h1>
    <p>We couldn’t load our notes right now. Please try again, or explore how we work.</p>
    <div className="blog-actions"><a className="primary-link" href="/blog">Try again ↻</a><Link href="/studio">Explore the studio ↗</Link></div>
  </section>;
}
