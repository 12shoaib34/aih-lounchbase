import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPost } from "../../../../server/site/posts";
import { BlogUnavailable } from "../unavailable";
import { renderMarkdown } from "../../../../server/site/markdown";
import { blogMetadata } from "../metadata";
import { formatDate } from "../format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { available, post } = await readPost(slug);
  if (!available) return { robots: { index: false } };
  if (!post) return {};
  const description = post.excerpt.trim() || `AppsInHours engineering insights: ${post.title}.`;
  return blogMetadata(post.title, description, `/blog/${post.slug}`, "article");
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const { available, post } = await readPost(slug);
  if (!available) return <BlogUnavailable />;
  if (!post) notFound();
  // renderMarkdown never emits author-controlled tags or attributes (raw HTML disabled; see markdown.ts).
  const html = renderMarkdown(post.content);
  return (
    <article className="wrap blog-article">
      <div className="page-back-row"><Link className="page-back" href="/blog"><span className="page-back-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="page-back-label">Back</span></Link></div>
      <div className="eyebrow">
        <Link href="/blog">JOURNAL</Link> /{" "}
        <time dateTime={post.publishedAt}>{formatDate(post.publishedAt).toUpperCase()}</time>
      </div>
      <h1 className="page-section-title">{post.title}</h1>
      {post.excerpt ? <p className="blog-meta">{post.excerpt}</p> : null}
      <div className="blog-body" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
