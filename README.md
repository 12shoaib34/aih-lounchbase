# AppsInHours + Launchbase

Step 2 provides a routing prototype. The public Work page and account fixture share one Next.js root. Public design migration starts at Step 3. Authentication and product data arrive in Step 5.

Install with `npm ci` and start development with `npm run dev`. Open /work and follow Account to /app/account. The editor uses disposable browser-local test data only.

Run `npm run build` for one Next compilation followed by OpenNext packaging. Run `npm run preview` for a local Worker. For the regression suite, build first, install Chromium with `npx playwright install chromium`, then run `npm run test:routing`. The suite starts a local Worker on port 8817. Set E2E_CHANNEL=chrome to use installed Chrome instead.

See [the checklist](CHECKLIST.md) and [migration plan](INTEGRATION-PLAN.md).
