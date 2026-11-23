# AppsInHours + Launchbase

The approved homepage and seven marketing detail pages share one Next.js root with Launchbase under /app. The enquiry API and server-rendered Insights reader use dedicated website tables. [Step 3 visual comparison](docs/verification/step-3-public-comparison.jpg) shows the donor and combined site side by side at mobile and desktop widths.

Install with `npm ci` and start development with `npm run dev`. Open /work and follow Account to /app/account. Account access uses the configured PostgreSQL identity database.

Run `npm run build` for one Next compilation followed by OpenNext packaging. Run `npm run preview` for a local Worker. For the regression suite, build first, install Chromium with `npx playwright install chromium`, then run `npm run test:routing`. The suite starts a local Worker on port 8817. Set E2E_CHANNEL=chrome to use installed Chrome instead.

See [the checklist](CHECKLIST.md) and [migration plan](INTEGRATION-PLAN.md).

## Website data

Apply the additive schema with `node scripts/migrate-site.mjs` against the intended `DATABASE_URL`. The website reads posts with a publication timestamp in the past. Preserve slugs, titles, excerpts, Markdown and publication dates when transferring approved articles.

Configure `PUBLIC_ORIGIN`, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` for enquiries. The Worker queues a team notification in the receipt transaction. Configure `RESEND_API_KEY`, `ENQUIRY_FROM` and `ENQUIRY_TO` for the five-minute scheduled consumer. Inspect undelivered rows in `site_notifications`. After 23 hours from a first attempt, reconcile ambiguous jobs with the provider before manual redelivery.

After building, run `npm run test:public-data` for the local, disposable database, mock provider checks and browser suite. Production recipient, DNS, verification keys, database connectivity and approved article inventory require operator confirmation before cutover.

## Launchbase accounts and workspaces

After building, run `npm run preview:identity` for a disposable local Worker and PostgreSQL instance. Open `http://127.0.0.1:8841/app/account`. Verification and recovery links go to the local database mail outbox. Stopping the preview removes its database. Run `npm run test:identity` to exercise signup, login, MFA, invitations, personal records and role checks with fixture accounts. Set `E2E_CHANNEL=chrome` to use installed Chrome.

For an independently configured environment, apply the pinned Launchbase migration history with `npm run db:migrate` using the intended PostgreSQL connection. Configure `AUTH_SECRET`, `AUTH_BASE_URL` (origin only), `AUTH_EMAIL_MODE`, and your signup, team invitation and administrative MFA policies. Hosted mail uses `resend` with `EMAIL_FROM` and `RESEND_API_KEY`. Keep provider secrets server-side. Account recovery follows the [operator procedure](docs/account-recovery.md). The admin overview links to Contacts, Files, Team, Accounts, Business settings and Audit trail according to the signed-in user’s permissions. Team, business settings and audit require the owner role. The account directory also accepts staff with the account-directory read grant.

Contacts and private file metadata use the Launchbase database. File contents use the Worker’s `FILES` R2 binding. Local Worker previews emulate the bucket. Hosted environments need a private bucket bound to `FILES`. Listing, downloading, uploading, reviewing and deleting files have separate grants.

Launchbase CSV exports include a version column for re-importing spreadsheet-escaped text and preserving tags. External CSV files use pipe-separated tags. An interrupted new file upload can resume against existing bytes only when the upload receipt matches the original user and payload. Other unreferenced objects remain available for operator review.

## Combined product verification

After a production build, run these local checks in order. The fixture scripts create disposable databases. Set `E2E_CHANNEL=chrome` to use an installed Chrome.

1. `npm run test:modules` exercises the database, permissions, scheduled deliveries, billing and a stopped-cluster restore on ports 54443 and 54444.
2. `npm run test:public-data` runs the public browser, routing, accessibility, SEO and enquiry suite.
3. `npm run test:identity` runs customer and staff browser journeys, including invoice PDF downloads.

The combined product incorporates Launchbase through `eee8e99`. Business settings include location hours, and billing supports installments and outstanding balances. Resource booking was retired. The migration retains historical records and removes booking grants. Customers can view their enquiries, invoices and notifications under `/app/account`. The five-minute Worker cron processes product inbox jobs when `QUEUE_SCHEDULE_ENABLED=true`. Email also requires `QUEUE_EMAIL_ENABLED=true` and a configured mail transport. Stripe checkout and signed webhooks use the server-side `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Register the webhook endpoint at `/api/billing-webhook` before enabling payments.

After the first owner registers and verifies their address, use `npm run owner:bootstrap -- <verified-email>` against the intended database. Owner transfer defaults to preview. Inspect the current owner and audit records after an interrupted operator command.

## Reusable website and enquiry tracking

Open `/website-template` for the starter website. Configure its brand, headline, service options and fallback email in `src/site/template/config.ts`. Add future website pages beneath `src/app/website-template` to inherit its layout. The public AppsInHours homepage, Contact and starter form share the same guest receipt API.

- Guest submissions create a receipt, a team notification and a private customer email job together. The owner can inspect submissions and update their status at `/app/admin/enquiries`.
- The email opens **My enquiries** at `/app/account/enquiries`. Verified account holders can also open this page directly to see submissions matching their verified email. Older `/app/track` links remain valid. Clicking **Sign in to view status** starts a seven-day session restricted to the emailed enquiry. The email link is single-use and valid for 24 hours. A customer can request another link with the full reference and matching email. Requests are limited to three links per enquiry per day and spaced five minutes apart.
- Launchbase also accepts enquiries at `/app/inquire`. Staff with inquiry management access process these in `/app/admin/inquiries`. Converting a submission to a contact also requires contact write access. Handling a new submission updates the customer status to Under review. Website form briefs stay in the owner tracking inbox.
- Apply both `npm run db:migrate` and `node scripts/migrate-site.mjs` to the same database. Configure Turnstile and the public origin for intake, and Launchbase auth origin and transactional mail for customer links. The Worker attempts initial delivery after receipt and retries pending mail through its cron. Monitor overdue rows in `site_tracking_access` without logging token columns. Existing receipts appear as Received. A schema upgrade alone does not email previous customers.

For a local demonstration, build then run `npm run preview:identity`. This loopback-only fixture simulates the verification provider and writes email to a private PostgreSQL outbox. To open your most recent fixture email on the development machine, run `npm run preview:mail -- your-test-address@example.com`. Set the same `IDENTITY_PORT` and `IDENTITY_DB_PORT` for both commands when using custom ports. This mailbox command also opens the existing account verification emails for local admin setup. The deployment entry is `worker.ts`.
