# Combined release rehearsal

Application revision `d45dcf2` combines the public AppsInHours site and Launchbase under one Next root. Marketing detail pages and the homepage render content in the first HTML response. The account and product screens live under `/app`. A single Worker serves both, the Hono API and the scheduled consumers. The old brand staff portal stays with its existing owner.

## Local evidence

The rehearsal uses an independent checkout, a lockfile install, installed Chrome, local workerd, private storage emulation and disposable databases. Run the following from the repository root.

```sh
npm ci
npm run lint
npm run build
npm run test:modules
E2E_CHANNEL=chrome CI=1 npm run test:public-data
E2E_CHANNEL=chrome CI=1 npm run test:identity
npx --no-install wrangler deploy --dry-run
```

| Check | What the test exercises |
|---|---|
| Build and Worker | One Next compilation with type checking, then OpenNext packages the result using `--skipNextBuild`. Wrangler dry-run reports packaged Worker size. |
| Public journeys | Homepage, Work, Services, Studio, Ventures, Engagements, Contact, Privacy, Insights and a published fixture article. Mobile menus, keyboard focus, both enquiry paths, failure and retry, draft exclusion and real missing routes. |
| Routing | Click through Home → Work → Services → Insights → Home at Ventures → Account → Work. Count main-frame document requests and preserve a marker on the root element. Exercise direct entries, query filters, back navigation and a dirty editor separately. |
| Authenticated journeys | Start from the public site, sign in, save a record, verify persisted data and return to the site. Exercise MFA, invitation acceptance, permissions and recovery. Visit new customer and staff routes and download a generated invoice PDF. |
| Product data | Concurrent bookings, cancellation, resources and permissions, inbox delivery and mail retries, signed payment events, draft edit conflicts, ISK checkout units, UGX conversion, idempotency, checkout rejection recovery, owner commands and audit. Provider responses are local fixtures. |
| SEO and accessibility | Check titles, descriptions, canonicals, social image metadata, structured data, robots, sitemap and private noindex. Scan Home, Work, Contact and Account with axe WCAG rules. Mobile checks also exercise keyboard and reduced motion. A clean automated scan covers only those states. |
| Recovery | Stop a disposable PostgreSQL cluster, copy it, start the copy on an independent port, and compare the synthetic account, enquiry, notification and migration count. Production database backups and private object storage require their own rehearsal. |

### Recorded results on 23 November 2026

- Clean install, correctness lint, production compilation, type checking and Worker packaging passed.
- All 22 automated tests passed: 8 module and database tests, 11 public browser and data tests, and 3 identity and workspace tests. The separate stopped-cluster restore comparison also passed.
- The six-link navigation sequence issued zero new document requests. Both Work concept dialogs opened repeatedly at 390px. The native dialog supported Escape and retained readable content on visual inspection.
- Axe reported zero violations in the four tested route states. The test does not cover every authenticated screen or replace a screen-reader audit.
- The final minified Worker dry-run measured 2,678.79 KiB gzip. Initial homepage HTML referenced eight scripts totalling 180,908 bytes when individually gzip-compressed. This excludes later interaction chunks, images and styles. Neither measurement is a real-user timing.
- Local preview returned HTTP 200 for Home, Work, Account, Billing, the health endpoint and the structured-data logo. The disposable account configuration allowed signup.

The first independent browser pass caught a dropped click on a Work concept card after route navigation. The card now opens the native dialog directly through React. A check of metadata assets also found the home Organization logo pointed at a missing path. The regression suite requests the corrected SVG.

## Deployment checklist

1. Obtain release approval, choose the target hostname and confirm ownership of existing private portal routes, inbound endpoints and blog publishing.
2. Pin the current live Worker version, asset deployment and routing configuration. Identify a rollback operator. Restore a current database backup in staging and verify private file backups.
3. Supply approved public articles and copy overrides. Configure the database, private R2 binding, public and auth origins, Turnstile keys, auth policies, mail sender and enquiry recipient. Keep secrets outside Git.
4. In staging, run both database migrations. Verify article URLs, a permitted enquiry, actual email receipt, staff access, a private file round trip and webhook delivery using Stripe test mode. Confirm SEO headers and Worker size, startup and runtime limits under the target account.
5. Confirm which Worker owns each queue and cron. Keep a single active consumer per environment. Reconcile outstanding payment attempts before enabling checkout, especially legacy ISK or UGX attempts.
6. Promote the exact approved artifact and assets together. Check representative public, private and API routes, plus signed-in save, enquiry receipt, queue depth, webhook outcomes and request errors.

## Rollback

1. Record the last healthy Worker version, rollback time and affected requests. Pause scheduled sends or payment initiation if their state is uncertain.
2. Restore traffic to the previous verified Worker and its matching assets and bindings. Restore the previous cron ownership and check public routes and account access.
3. Preserve new database rows. Reconcile enquiry receipts, provider events, mail and pending jobs by their stable identifiers before replay. Restoring a database requires a separate assessment of writes accepted since the backup.
4. Verify outstanding alerts and queues, document observed impact, and schedule another staging rehearsal before retrying cutover.

## Verification boundaries

Hosted Cloudflare limits, production email, Turnstile, live Stripe, inbound traffic, search indexing and real-user Web Vitals need the intended deployment environment. The production-dependency audit returned zero advisories locally. The complete development tree reported four high and one moderate advisory in the OpenNext build-tool dependency chain. Review the adapter upgrade separately before release.
