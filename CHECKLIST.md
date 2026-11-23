# Integration checklist

Use this list alongside [the migration plan](INTEGRATION-PLAN.md). Tick a task after checking its result and recording evidence. Tick the numbered step when its exit criteria are met. Update today's context at each checkpoint.

- [x] **1. Baseline and extraction** · [Verified evidence](docs/baseline/README.md)
  - [x] Pin donor revisions and verify the approved design.
  - [x] Inventory files, assets, licences, copy sources, API contracts and environment names.
  - [x] Map public/product routes, redirects, deep links, grants and private exclusions.
  - [x] Capture mobile and desktop references and document replayable fixture journeys.
  - [x] Inspect the evidence and record outstanding owner decisions.
- [ ] **2. Prove one runtime and proper routing**
  - [ ] Create one Next root with site and product layouts, Work, account and a Hono endpoint.
  - [ ] Verify one build, Worker preview, direct refresh, no-reload transitions, 404s and dirty-editor behavior.
- [ ] **3. Port the approved public design**
  - [ ] Migrate the home sections, five Work cards, menus and interactions.
  - [ ] Migrate the seven public detail pages and verify responsive, keyboard and motion parity.
- [ ] **4. Restore public data journeys**
  - [ ] Verify paid and venture enquiries, persistence, retries, fallback and notifications.
  - [ ] Verify public blog, metadata, sitemap, aliases, unavailable and missing states.
- [ ] **5. Migrate Launchbase identity and shells**
  - [ ] Port account, invite, auth, MFA, personal/staff layouts and reference records.
  - [ ] Verify role boundaries, callbacks, deep links and session isolation.
- [ ] **6. Migrate Launchbase modules**
  - [ ] Team, accounts, business settings and audit.
  - [ ] Contacts and private files.
  - [ ] Notifications and jobs.
  - [ ] Scheduling and bookings.
  - [ ] Billing, invoices and webhooks.
  - [ ] Verify permissions, retries and inherited issue disposition per slice.
- [ ] **7. Rehearse the combined release**
  - [ ] Run clean build, integration, browser, accessibility and Worker checks.
  - [ ] Verify combined route matrix, SEO, JS weight and restore rehearsal on the release artifact.
- [ ] **8. Approved cutover**
  - [ ] Confirm operational dependencies, owner approval, backup and rollback target.
  - [ ] Switch traffic, smoke-test and reconcile background jobs and data.
