# AppsInHours + Launchbase migration plan

**23 November 2026 · Proposed architecture.** Build one Next.js app in this repository, with one package, one lockfile, one dev command, one application compilation and one deployable artifact. AppsInHours owns the public website. Launchbase owns the product screens under **/app**. One shared root layout and the Next App Router own browser navigation throughout. PostgreSQL and configured service providers remain external. All implementation chunks below are pending.

## Source of truth and import boundary

| Source | Include | Exclude |
|---|---|---|
| Local appsinhours-brand, improve/brand-content-seo at **06bdfa4** | New-design public homepage, details, Work assets, mobile menu, motion settings, paid and venture forms, public blog reader, privacy, metadata and public 404. Translate relevant markup to React route components using the approved CSS and visual references. | Old staff portal, OTP login, proposal review, blog admin, copy editor, inbound mail, staff APIs, private records, donor deployment workflows and secrets. |
| Local launchbase, main at **bad719f** | Account, customer and administration features, layouts, reusable components, Hono business APIs, Better Auth, PostgreSQL migrations, product configuration, jobs and test fixtures. | Standalone Vite entry, template marketing homepage and global SPA fallback. Keep the component gallery a development reference unless needed publicly. |
| aih-lounchbase | Own the integrated routes, dependencies, environment bindings, tests and release configuration. | Neither donor needs restructuring. At inspection, the approved website branch was four commits ahead of its remote. Pin the **local** revision so the five-card portfolio survives extraction. |

Preserve the equity-first hero, original single-page style, nine home sections, public detail routes and the five portfolio cards in their current order: SabiWorkers, FoodChoo, PakGo, ordering concept, mobile concept. “Website only” excludes the brand portal. Launchbase’s own customer and admin features belong to the new app.

## Routing — the first implementation contract

### What reloads today

Browser check on the donor using Chrome and local Next dev: clicking Work in the homepage header changed the URL to /#work, retained a window marker and made **zero new main-document requests**. Clicking the full portfolio link to /work made **one new document request** and cleared the marker. The section navigation already works within one document; the transition to a separate public page reloads it.

The public HTML and native links are in appsinhours-brand/dist. web/scripts/sync-legacy.ts copies these documents to public, web/src/lib/legacy-routes.ts and web/src/proxy.ts handle aliases/rewrites, and even web/src/app/blog/page.tsx uses plain internal links. Simply changing the header leaves destination documents outside the React route tree. On the other side, launchbase/src/App.tsx creates a wildcard browser router and launchbase/wrangler.jsonc enables SPA fallback. Neither donor’s catch-all should own the new site.

### Who owns each URL

| Public-facing URL | Owner and contract |
|---|---|
| / | Static/prerendered Next homepage. Keep #home, #about, #work, #services, #process, #ventures, #pricing, #faq and #contact. |
| /services, /studio, /ventures, /work, /engagements, /contact, /privacy | Explicit marketing pages. Preserve section IDs, including /work#foodchoo, /work#pakgo, /work#sabiworkers, /ventures#partnership-terms and /contact?engagement=venture#brief. Preserve existing service, project, pricing and brief preselection contracts. |
| /blog, /blog/[slug] | Public server-rendered listing and article pages. Preserve published slugs, metadata, unavailable state, sanitized article rendering and true 404s. |
| /app | Proposed product entry. Signed-out visitors go to /app/account; signed-in visitors go to a permitted landing screen. |
| /app/account, /app/invite | Account entry/profile, signup, password recovery, MFA challenge and invitation acceptance. Signed-out users must reach these entry points. Preserve reset query parameters and invite fragments. |
| /app/account/{security,two-factor,billing,bookings,notifications}, /app/workspace | Account settings and personal workflows. Preserve per-user access, records, bookings, invoices and inbox. |
| /app/admin, /app/admin/{team,accounts,business,contacts,files,notifications,scheduling,billing,audit} | Launchbase administration with existing grants. Include /app/admin/contacts/[id], /app/admin/billing/new, /app/admin/billing/[id] and /app/admin/billing/[id]/edit. Test “new” vs a dynamic invoice ID. |
| /api/enquiry | Exact public GET configuration + POST submission contract with a dedicated handler and isolated storage adapter. |
| /api/* owned by Launchbase | Preserve its existing API prefix, including /api/auth/* and /api/billing-webhook. A Next catch-all **API** handler dispatches supported methods to Hono; the specific enquiry route takes precedence. Only product screen URLs acquire /app. Unknown API endpoints return JSON 404. |
| Aliases, unknown and retired URLs | Map verified public aliases such as /services.html and /index.html to canonical paths in one redirect. Test slash variants and query/fragment retention. Unknown public/product URLs return HTTP 404. Remove Staff login and proposal-review links from the imported site. Never forward an old staff session or document link into Launchbase admin. |

Use **one src/app/layout.tsx** for the document. Put website pages in **src/app/(site)/** with their own nested marketing layout. Put Launchbase pages in **src/app/app/** with a nested product layout, which creates the real /app prefix. Route groups alone do not create URL prefixes. Keep QueryClient, confirmation dialogs and workspace providers inside the product subtree. Scope CSS, theme and loader behavior so the marketing intro does not appear on dashboard navigation.

### How proper Next navigation will work

1. Use next/link for ordinary internal page links across both trees. Keep same-page anchors native. Use a Next link with canonical path and fragment when linking across pages. Keep external links, mail, file downloads and provider redirects native. For app actions use next/navigation. Direct URLs and manual refreshes should still load a document.
2. Replace React Router’s Route/Outlet, navigation links, redirects, params, filters and navigation hooks with explicit file routes, nested layouts and shared path builders. Inventory generated URLs in emails, invites, reset flows and Stripe return links as well as UI links. Validate return destinations and preserve required query strings.
3. Port scripts that assume DOMContentLoaded to scoped client components with mount and cleanup. Dispose listeners, GSAP scroll triggers, timers, observers and canvas effects. Re-enter Home twice and check for duplicate handlers, carousel pins, stuck loader, stale dialogs or duplicate enquiry submissions. Preserve fixed-header offsets, active section, mobile close/focus and Back/Forward scroll restoration in both document and dashboard scroll containers.
4. Prototype dirty-form navigation **before** porting complex editors. Launchbase uses React Router useBlocker in src/components/ui/UnsavedChanges.tsx. A Next link does not replace its behavior. Demonstrate cancel/discard, pending save, Back/Forward, logout, tab close and refresh. Preserve the draft or block the move where supported; document native browser limitations. Do not ship silent loss of a dirty invoice/contact form.
5. **Pass condition for routing:** in a production-mode browser test, set a random window marker after hydration and count top-level document requests. Click Home → Work → Services → Blog → Home#ventures, site → app, app sidebar → detail, then app → site. Expect **the same marker and zero new document requests** on ordinary internal navigation. RSC/data requests are expected. Separately test new tabs, keyboard activation, direct entry, hard refresh on a nested ID, auth redirects, history, fixed-header hashes, query filters and real 404s. Verify public pages with JS disabled. An animation that conceals a document reload fails this test.

[Next.js guidance on server rendering and client-side navigation](https://nextjs.org/docs/app/getting-started/linking-and-navigating)

## Integration decisions and dependencies

| Area | Source evidence and implementation decision |
|---|---|
| Single build | Brand web/package.json pins Next 16.4.5, React/DOM 19.3.1 and OpenNext. Launchbase uses React 19.3.1-compatible dependencies with Vite. Resolve and pin one compatible tree. Use one Next compilation and package its output for one Cloudflare Worker. Ensure the adapter command does not invoke the Next build twice. Verify clean-install logs, bundle size and workerd compatibility. One application build can emit server and browser assets. |
| Backend | launchbase/server/index.ts mounts Hono modules, auth, request IDs, no-store headers and scheduled work. Retain business handlers, feed the Next API adapter the real request and Cloudflare bindings/context. Preserve multiple cookies, methods, status codes, streamed files and unmodified signed webhook bodies. Keep scheduled events in the same Worker entry. Do not copy the old website cron wholesale. Verify jobs, PDF generation and private storage in the target runtime. |
| Identity and isolation | Keep Better Auth and Launchbase access rules. Enforce permissions in APIs as well as screens. Port trusted origins, callback URLs, cookie paths, CSRF checks, MFA and invites. Keep private responses uncached, clear client caches on identity change, isolate server secrets and verify direct low-privilege access. Review src/app/router.tsx, Route.md, src/api/client.ts, src/lib/env.ts, server/access.ts and server/auth*.ts. |
| Database | Launchbase has versioned SQL through 033_invoice_zero_balance.sql. Use that migration history on a fresh isolated PostgreSQL DB. The brand enquiry handler writes records, notifications and audit, and its blog reader imports Prisma. Avoid copying private brand tables or applying both donors’ migration histories. Add narrowly scoped website tables or read adapters with separate migrations and explicit data ownership. |
| Enquiry boundary | Preserve the UX and GET/POST contract in brand web/src/server/api/enquiry.ts without its portal DB dependency. Proposed sink: a public-enquiry record and notification job accepted atomically. Preserve goal-specific validation, origin, Turnstile, throttling, failure/retry and early email fallback. Deduplicate retries including an ambiguous response after persistence. Confirm recipient and operational destination before cutover; an extra management UI is outside this plan. |
| Public copy and blog | dist/site.js reads /api/copy; inventory approved public overrides before freezing public copy. Use a published-only blog reader/import preserving slugs, dates and sanitized body. Keep draft posts, private CMS and users at source. Preserve metadata/sitemap/noindex behavior when the reader is unavailable. Decide where future authors publish before retiring any existing workflow. |
| SEO and frontend weight | Public headings, portfolio items and important tables must appear in the first HTML response. Use client components for interaction and request-time auth where needed. Private app screens are noindex. Keep dashboard-only JS, charts and billing/PDF dependencies off marketing routes. Verify canonicals, social images, structured data, robots and a published-only sitemap on the built artifact. |
| Launchbase risk register | Source AUDIT_1.md and Resume.md record payment unit conversion, checkout recovery, orphan file overwrite, CSV round-trip/skip, DST booking windows and ambiguous owner-script completion. Treat these as inherited reports, not fresh reproductions. Before enabling an affected module, verify relevant fixtures and resolve or withhold it. Track scope explicitly so a framework port cannot be mistaken for fixing existing business logic. |

## Chunk sequence and evidence required

Each chunk ends with a working checkpoint, personal inspection and an update to the dated context. UI acceptance includes a normal browser journey as well as automated tests.

| Chunk | Work | Exit evidence |
|---|---|---|
| 1 · Baseline and extraction | Pin both SHAs. Inventory files, public overrides, URLs/aliases, query contracts, grants, generated links, assets/licences and environment **names**. Capture desktop/mobile baselines. Record exactly which old private routes and services remain owned elsewhere. | Reviewed import allowlist and exclusion list; visual baselines, URL matrix and reproducible public/private fixture journeys. |
| 2 · Prove routing and runtime | Scaffold the shared Next root, public and /app layouts, a minimal public Work route, app/account, one Hono endpoint and a representative dirty editor. Build the Worker locally from one app compilation. | One dev command; no separate Vite server. Work → app/account → Work passes the no-reload test. Direct refresh, HTML response, real 404, dirty-form and local Worker checks pass. Avoid migrating dozens of pages until this works. |
| 3 · Public design | Port the homepage, then Work, Services, Studio, Ventures, Engagements, Contact and Privacy. Reuse existing design, public assets and the behavior in web/visual/onepage.mjs. Adapt the nav, dialogs, form selections and animations to Next lifecycles. | Compare 390px and 1440px screenshots and check 320px overflow. Verify five portfolio cards/controls, no-JS content, color themes, reduced motion, keyboard/focus, section links and repeated visits. |
| 4 · Public data | Deliver enquiry persistence + notification and published Insights pages against isolated fixtures. Port metadata, aliases, canonical URLs, robots, sitemap and error states. | Paid and venture briefs, retries, validation, DB acceptance/outbox, article direct URLs, excluded drafts and missing-slug 404 verified. Verify zero requests to the old portal/copy APIs. |
| 5 · Launchbase identity and shells | Port configuration, SQL, core Hono adapters, account and invite flows, sessions/MFA, personal and staff frames, navigation and records. Use disposable DB and test mail. | Signed-out/customer/staff/owner tests, callback and deep-link checks, no stale identity/cache, server permission denials and local auth recovery. |
| 6 · Product modules one slice at a time | Team/accounts/business/audit → contacts and files → notifications/jobs → scheduling and bookings → billing/invoices/webhooks. Each slice includes the customer side, API, UI and applicable jobs/tests. | Direct and in-app navigation, save/discard, access revocation, personal data isolation, concurrent updates and retries verified. Payments/storage/email use provider fixtures or authorized sandbox. |
| 7 · Combined release rehearsal | Run typecheck, lint, unit, PostgreSQL integration, browser, accessibility and Worker preview tests. Compare first-response HTML, 404 status, header policies, assets, layout, cold-load and public JS. | One clean reproducible artifact, completed route matrix, navigation request evidence, permission matrix, restore rehearsal and explicit unverified items. Hosted staging checks require authorization/configuration. |
| 8 · Approved cutover | Validate published article inventory and the enquiry destination; preserve ownership of existing live private URLs. Pin previous Worker/assets, restore-test backup, use additive migrations, switch traffic only with release approval. | Smoke public site, private login, grants, enquiry and blog. If failing, restore previous traffic routing/artifact, stop duplicate consumers, reconcile pending writes/jobs. A DB restore is a separate recovery decision. |

## Decisions and handoff

- Use **/app** as the proposed product prefix. Freeze it before generating emails and payment return links. If old Launchbase URLs have users, inventory exact aliases, including token fragments, before cutover.
- Confirm business ownership for enquiry notifications, published article import and future authoring. These decisions do not block the routing prototype.
- Confirm how the existing brand staff workflows and inbound endpoints will continue to be served if the public hostname changes hands. Keep that operational cutover separate from extracting website code.
- Planning checked source and one donor browser journey. No combined build, auth flow, production data migration, payment, email or deployment has been verified.
- **First implementation action:** create the pinned extraction and route manifest, then demonstrate a public-to-product soft transition in the minimal combined app.
