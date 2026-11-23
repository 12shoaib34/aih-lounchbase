import Link from "next/link";
import type { Metadata } from "next";
import { listPosts } from "../../../server/site/posts";
import { BlogUnavailable } from "./unavailable";
import { blogMetadata } from "./metadata";
import { formatDate } from "./format";

export const dynamic = "force-dynamic";

const listingMetadata = blogMetadata(
  "Software delivery insights",
  "Practical articles for founders choosing between a prototype and an MVP or preparing a software project for development.",
  "/blog",
  "website",
);

export async function generateMetadata(): Promise<Metadata> {
  return (await listPosts()) !== null ? listingMetadata : { ...listingMetadata, robots: { index: false } };
}

export default async function BlogIndex() {
  const posts = await listPosts();
  if (posts === null) return <BlogUnavailable />;
  return (
    <section className="wrap blog-index">
      <div className="page-back-row"><Link className="page-back" href="/"><span className="page-back-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="page-back-label">Back</span></Link></div>
      <div className="blog-opening">
        <div className="eyebrow">INSIGHTS</div>
        <h1>Notes on planning and building software.</h1>
        <p>Practical notes on testing a product idea, choosing a first release and preparing for development.</p>
      </div>
      {posts.length === 0 ? (
        <div className="blog-empty">
          <h2>Our notes will appear here.</h2>
          <p>For now, explore how we define scope, review progress and prepare a release.</p>
          <Link href="/studio">See how we deliver ↗</Link>
        </div>
      ) : (
        <ul className="blog-list">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link href={`/blog/${post.slug}`}>
                <time className="blog-meta" dateTime={post.publishedAt}>
                  {formatDate(post.publishedAt)}
                </time>
                <h2>{post.title}</h2>
                {post.excerpt ? <p>{post.excerpt}</p> : null}
                <span className="blog-read" aria-hidden="true">Read the article ↗</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="blog-close">
        <h2>Have a product decision to work through?</h2>
        <Link className="primary-link" href="/contact">Discuss your project ↗</Link>
      </div>
    </section>
  );
}
