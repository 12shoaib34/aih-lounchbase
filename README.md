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

For an independently configured environment, apply the pinned Launchbase migration history with `npm run db:migrate` using the intended PostgreSQL connection. Configure `AUTH_SECRET`, `AUTH_BASE_URL` (origin only), `AUTH_EMAIL_MODE`, and your signup, team invitation and administrative MFA policies. Hosted mail uses `resend` with `EMAIL_FROM` and `RESEND_API_KEY`. Keep provider secrets server-side. Account recovery follows the [operator procedure](docs/account-recovery.md). Step 6 covers the business modules.
