# Step 1 · Donor extraction and route baseline

**23 November 2026.** Use this as the reference for implementation in the new repository. Files below refer to paths inside the named donor at its pinned revision. The first push to the destination was verified before this extraction started.

| Donor | Immutable input | What the baseline represents |
|---|---|---|
| appsinhours-brand | improve/brand-content-seo · `06bdfa493b9897b6ab41b77f45088b6ea4dd80f8` | Clean local branch, four commits ahead of its tracked remote. Hero “We build your MVP for equity.” Portfolio contains three projects and two original concepts. Preserve access to this local commit when setting up another machine. |
| launchbase | main · `bad719f1c8066ad7a2464faaea91fbe7beaa5fad` | Clean donor. Built an isolated archive of this commit with its lockfile, then ran its local fixture Worker. No hosted database or customer data used. |

## Extraction manifest

[Machine-readable inventory](inventory.json) lists every tracked brand dist file with its treatment; every public HTML source with its direct script/style/image references, element IDs, editable copy keys, brief field names, query/fragment links and pricing contexts; and Launchbase route declarations, Hono module mounts and environment **names**. Treat references as a dependency inventory: rebuild navigation and lifecycle behavior in Next rather than loading every old script.

| Source area | Treatment |
|---|---|
| Brand dist/index, services, studio, ventures, work, engagements, contact, privacy and 404 HTML | New public route components. Preserve public style, assets and interactions. Keep the standalone detail pages as well as the nine homepage anchors. |
| Brand web/visual/onepage.mjs, cloud-brain*.mjs and corresponding dist bundle, hero-grid.js, opening-loader.*, menu, theme and detail scripts | Reuse actual behavior or translate to mounted components with cleanup. Inspect dynamic and CSS asset references in addition to the HTML inventory. The hero, five-card carousel and page loader need their own parity checks. |
| Brand web/src/app/blog/, web/src/lib/blog/{posts,markdown,slug,sitemap}, web/src/app/sitemap.xml/route.ts | Retain published reader behavior. Metadata helper is specifically web/src/app/blog/metadata.ts. Use published article data only. Draft readers, editor and administrative revalidation credentials do not come across. |
| Brand dist/site.js, web/src/server/lib/copy-catalog.ts | 23 editable-key occurrences across public HTML. Local GET /api/copy returned HTTP 200 with zero overrides for each of the eight marketing sources. Preserve source copy; approved live overrides still require an owner-supplied public export before cutover. |
| Brand web/src/server/api/enquiry.ts and dist/{brief-context,contact,enquiry,onepage}.js | Preserve form contracts, verification and user journeys. Replace portal-specific storage/notification adapters. Keep paid build, team, improvement, venture qualification, optional fields, pricing context and retry handling. |
| Brand private and operational assets | Exclude portal.*, proposal-review.*, board.js, /login, /portal (including blog admin), /proposal-review, old /api/portal, old OTP/auth, /api/admin/posts, /api/admin/users, /api/proposal-review, /api/inbound, /api/internal/cron and old publishing/revalidation secrets. Old private operational URLs stay with their existing operator until ownership is agreed. Reconstruct public headers/robots/sitemap as applicable; .well-known mail policy belongs with its DNS/mail operator. A Launchbase API with an overlapping name remains a separate contract. |
| Launchbase product | Port src/features/{account,admin,workspace}, necessary components, app layouts/navigation, src/api/client.ts, stores and shared schemas. Use src/app/router.tsx and Route.md as the screen/grant reference. Keep product.config.json inputs under the new project's ownership. Adapt root-bound links and VITE_API_BASE_URL; exclude the generic template homepage, sample assets, development gallery, React Router bootstrap and Vite SPA fallback from the production route tree. |
| Launchbase backend | Preserve server/index.ts mounts, server/{access,auth,auth-configuration,database} and module handlers, 33 SQL migrations and the local integration/recovery tests. Preserve operator jobs and per-request/per-user boundaries. Scheduled events, FILES, database access, notification delivery and Stripe callbacks need separate runtime verification. |

**Asset/licence inventory.** Brand wordmarks, icons, social preview, cloud shape and portfolio photography appear under dist; FoodChoo and PakGo imagery is editorial, not product screenshots. Preserve shipped bundle notices (chapters, cinema, onepage) if their code ships. The brand stylesheet requests DM Sans from Google Fonts. Launchbase ships Inter with public/fonts/Inter-LICENSE.txt and PDF-related Roboto files with src/assets/fonts/OFL-Roboto.txt. Retain notices with any redistributed fonts. For editorial photos and brand-owned art, inventory is evidence of use; verify publication rights/attribution with the owner before redistribution.

## URL and workflow matrix

| Source entry | Combined destination | Checks |
|---|---|---|
| /, homepage #home, #about, #work, #services, #process, #ventures, #pricing, #faq, #contact | Same | All five Work entries; hash offset, carousel, form, Back/Forward, keyboard and reduced motion. |
| /services, /studio, /work, /ventures, /engagements, /contact, /privacy | Same | Preserve canonical and current section targets, including #foodchoo, #pakgo, #sabiworkers and #partnership-terms. |
| /blog and /blog/:slug | Same | Index published posts only. The local listing displays its unavailable state; published slugs and future publishing owner remain open. |
| /index.html, clean-page .html and slash aliases | Canonical public page | Observed 308 on /index.html, /services.html and /services/; unknown baseline URL returned 404. Test query/fragment retention in the combined app. |
| Contact entry | Same public routes plus /api/enquiry | Old and current service choices, engagement=venture, serviceArea, projectType, solution, all 15 pricing selections; preserve query/fragment and in-page preselection. Use inventory.json for exact links and form names. |
| /account, /invite | /app/account, /app/invite | Public account entry, recovery, MFA challenge and invite; protect authenticated profile. server/team.ts generates invitation fragments; InvitePage.tsx scrubs them. AccountPage.tsx and SecurityPage.tsx construct verification, reset and deletion callbacks. |
| /workspace; /account/security, two-factor, billing, bookings, notifications | Same paths prefixed /app | Signed-in user's own records/settings. Preserve filter/search state, drafts and session boundaries. server/billing.ts builds Stripe return/cancel links. |
| /admin; /admin/team, accounts, business, audit | Prefix /app | Admin overview requires team membership. Team/business/audit owner-only, accounts users:read. Preserve additional MFA gate when configured. |
| /admin/contacts and /admin/contacts/:id; /admin/files, notifications, scheduling | Prefix /app | Contacts:read, files:read, notifications:read, scheduling:read respectively; separate grants for mutations, downloads and exports. Grants are checked on the server. |
| /admin/billing, /admin/billing/new, /admin/billing/:id, /admin/billing/:id/edit | Prefix /app | Billing read/create/edit distinctions, lifecycle grants and owner-only recovery. Keep literal new ahead of dynamic ID and preserve list context. |
| Template / and /components; wildcard | Dedicated /app entry; gallery developer-only; genuine 404 | Unknown product paths must not render the marketing homepage or an HTTP-200 SPA shell. |
| Launchbase /api/* | Existing API prefix behind Hono | Keep Better Auth URLs, allowed methods, no-store, raw webhook and status semantics. Reserve exact /api/enquiry separately. Donor /api/health returned 200; /api/contacts returned 503 with auth unconfigured. This is not an authenticated authorization test. |

## Browser and fixture evidence

- [Website observations](site-observations.json): nine public URLs at 390×844 and 1440×900. All 18 loads returned HTTP 200. On both widths a window marker survived the home Work hash transition and no document request fired. The full portfolio click requested /work as a new document and lost the marker. This is the Step 2 regression target.
- [Product observations](product-observations.json): six loads across /account, /workspace and /admin on the isolated, auth-unconfigured Worker. Captures were taken after access/unavailable states settled. The donor build completed and Vite reported a large-chunk advisory. No signed-in parity or combined build is claimed.
- [Mobile hero](screenshots/site-home-390.jpg), [desktop hero](screenshots/site-home-1440.jpg), [mobile Work](screenshots/site-work-390.jpg), [desktop Work](screenshots/site-work-1440.jpg), [mobile Contact](screenshots/site-contact-390.jpg) and [desktop Contact](screenshots/site-contact-1440.jpg). Product captures for all three entries at both widths are in [screenshots](screenshots/).
- **Public fixtures executed:** start brand web with `npm run dev -- --hostname 127.0.0.1 --port 3018`; from that same web folder run `E2E_CHANNEL=chrome E2E_NEXT=http://127.0.0.1:3018 npx playwright test compact-enquiry.spec.ts`. All 10 passed, including goal selection, venture qualification, menu keyboard order, ambiguous receipt, retry, verification and fallback. These tests intercept submissions.
- **Product unauthenticated fixture replay:** in an isolated checkout at the pinned SHA, run `npm ci`, `npm run build`, then `node scripts/test-server.mjs`. Open the three product entries above at 127.0.0.1:8799. No auth configuration is needed for these baselines.
- **Signed-in fixture replay, inventoried and deferred:** follow the donor CI setup with disposable PostgreSQL 17, local email outbox, isolated DATABASE_URL and `npm run db:migrate`. Install the browser in that checkout. Run `npm run test:auth:e2e -- tests/auth-browser/records.spec.ts tests/auth-browser/contacts-navigation.spec.ts tests/auth-browser/contact-permissions.spec.ts`. These fixtures exercise signup/verification and record edits, dirty form navigation and staff grant revocation. They modify fixture data (including clearing test rate limits), so use a dedicated database. This baseline had neither local PostgreSQL binaries nor Docker. Authenticated migration acceptance belongs to Steps 5–6.

## Handoff

Before cutover, identify who owns existing portal/inbound traffic, public enquiry delivery and future blog publishing; obtain published content, approved overrides and asset rights. Production delivery, indexing, signed-in sessions and hosted bindings remain unverified. These are tracked decisions for later steps. The next implementation step is a minimal /work → /app/account → /work flow that preserves one browser document.
