// Server-side Markdown → HTML for blog posts.
//
// The blog CSP allows inline scripts ('unsafe-inline', needed for cached ISR HTML — see src/lib/security/csp.ts),
// so the CSP is no defence against injected markup: post content itself must never produce HTML. markdown-it is
// configured so it cannot:
//   * html: false   — raw HTML blocks and inline tags in the source are emitted as escaped text, never as tags;
//   * every text/attribute value goes through markdown-it's escapeHtml (& < > ");
//   * links and images: only http(s), mailto and relative/fragment URLs survive (no javascript:, vbscript:,
//     data:, file:, protocol-relative //host); anything else is rendered as plain text by markdown-it;
//   * external links get rel="nofollow noopener noreferrer".
// The renderer emits no attributes markdown-it does not create itself (no on* handlers, no style).
import MarkdownIt from "markdown-it";

const SAFE_URL = /^(https?:|mailto:)/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Accepts absolute http(s)/mailto URLs and scheme-less relative URLs; rejects everything else. */
export function isSafeUrl(url: string): boolean {
  // Browsers ignore ASCII whitespace/control characters inside a scheme ("java\tscript:"): strip them first.
  // oxlint-disable-next-line no-control-regex -- intentionally normalize URL control characters.
  const compact = url.replace(/[\u0000- \u007f]/g, "");
  if (compact.startsWith("//") || compact.startsWith("\\\\") || compact.startsWith("/\\")) return false;
  if (HAS_SCHEME.test(compact)) return SAFE_URL.test(compact);
  return true;
}

const md = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
md.validateLink = (url) => isSafeUrl(url);

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx];
  if (token && /^https?:/i.test(String(token.attrGet("href") ?? ""))) token.attrSet("rel", "nofollow noopener noreferrer");
  return self.renderToken(tokens, idx, options);
};

/** Renders trusted-or-not Markdown to HTML that contains no author-controlled tags or attributes. */
export function renderMarkdown(source: string): string {
  return md.render(source);
}
