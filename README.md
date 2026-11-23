# AppsInHours + Launchbase

The approved homepage and seven marketing detail pages share one Next.js root with the account fixture. The enquiry API and server-rendered Insights reader use dedicated website tables. Authentication and product data arrive in Step 5. [Step 3 visual comparison](docs/verification/step-3-public-comparison.jpg) shows the donor and combined site side by side at mobile and desktop widths.

Install with `npm ci` and start development with `npm run dev`. Open /work and follow Account to /app/account. The editor uses disposable browser-local test data only.

Run `npm run build` for one Next compilation followed by OpenNext packaging. Run `npm run preview` for a local Worker. For the regression suite, build first, install Chromium with `npx playwright install chromium`, then run `npm run test:routing`. The suite starts a local Worker on port 8817. Set E2E_CHANNEL=chrome to use installed Chrome instead.

See [the checklist](CHECKLIST.md) and [migration plan](INTEGRATION-PLAN.md).

## Website data

Apply the additive schema with `node scripts/migrate-site.mjs` against the intended `DATABASE_URL`. The website reads posts with a publication timestamp in the past. Preserve slugs, titles, excerpts, Markdown and publication dates when transferring approved articles.

Configure `PUBLIC_ORIGIN`, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` for enquiries. The Worker queues a team notification in the receipt transaction. Configure `RESEND_API_KEY`, `ENQUIRY_FROM` and `ENQUIRY_TO` for the five-minute scheduled consumer. Inspect undelivered rows in `site_notifications`. After 23 hours from a first attempt, reconcile ambiguous jobs with the provider before manual redelivery.

After building, run `npm run test:public-data` for the local, disposable database, mock provider checks and browser suite. Production recipient, DNS, verification keys, database connectivity and approved article inventory require operator confirmation before cutover.
