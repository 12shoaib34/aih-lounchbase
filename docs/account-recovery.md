# Operator recovery after losing every MFA factor

This procedure is for an existing, verified password account whose authenticator and unused recovery codes are unavailable. Try an unused recovery code first. The CLI is an operator database tool, not an HTTP endpoint or owner/staff permission. It never authenticates a claimant, changes their email, grants a role, sends mail, reveals a replacement password, or signs them in. Do not use it for an unverified account, disputed ownership, an unavailable/compromised mailbox, or an active compromise; those require a separate incident and identity-resolution process.

## Establish authority before touching credentials

Use the client's agreed recovery policy and an independently established contact channel. For an owner, verify against the client contract and pre-registered recovery contact; for a staff/customer account, obtain the designated client's authorization and verify the claimant independently. A request from the affected mailbox, a current browser session, publicly available business information or security-question answers alone is insufficient. If no recovery authority/channel was established at handover, stop and establish ownership through the client's authorized legal/contractual representative. The tool cannot supply that judgment.

Create a private recovery case with a new UUID. Record the named executing operator, independent reviewer/approver, account ID and expected existing email, evidence checked, authorization, timestamp, intended deployment/database, user notification and outcome. Keep identity evidence and personal documents in the client's restricted case system, never in Git, logs, command arguments or the application audit. The database stores only the case UUID and account reference; possession of the UUID is not proof of identity or approval. Notify the established contact before and after recovery through an independently verified channel; notification is a manual obligation, not an implemented email delivery guarantee.

## Pause, expire outstanding links, and preview

1. Confirm the intended client deployment, database and all applied migrations (through 031). Use the dedicated operator connection privately. Rehearse in staging before a real incident. The runtime database credential is not an operator role recommendation.
2. Block **all authentication and account API traffic to every instance**, including signed email links, and drain in-flight requests/jobs that can modify authentication state. Keep traffic blocked throughout the operation. A row lock cannot cancel an already-running library flow. `--quiesced` is an operator attestation, not a traffic switch or detector.
3. Keep authentication blocked until every previously issued stateless email verification/change link has expired. The installed configuration/library uses a one-hour lifetime: allow at least 65 minutes from the last possible issuance, with verified clocks. If the client changes the token lifetime/library, inspect it and extend this wait to the longest applicable lifetime plus clock margin. These signed links are not stored in `verification` and the CLI cannot revoke them. Do not rotate AUTH_SECRET casually: it also protects encrypted MFA data for other accounts. This initial procedure deliberately incurs deployment-wide authentication downtime; targeted recovery without that downtime is future work.
4. Verify the user's existing mailbox is still controlled by the verified claimant and normal password-reset email delivery is working. Keep `AUTH_ADMIN_MFA_REQUIRED=true` for deployments requiring administrator MFA; do not disable it to regain access. It continues to deny administration until the new session has valid factor proof.
5. With DATABASE_URL supplied privately (normally `.dev.vars`), preview using exact account ID, expected email and a new private case UUID:

```sh
npm run account:recover-mfa -- ACCOUNT_ID EXISTING_EMAIL CASE_UUID
```

Preview runs a read-only transaction and reports `eligible`, without returning identity details or credentials. It checks the ID/email pair, verified status, enabled MFA and exactly one password credential account. Linked/social accounts are rejected. Recheck the target against the private case; preview is not an authorization token and apply checks current state again. Shell history/process arguments include account ID/email; run only on the restricted operator workstation and handle its history according to client policy.

## Apply and restore access

After the independent identity review and completed pause/expiry wait:

```sh
npm run account:recover-mfa -- ACCOUNT_ID EXISTING_EMAIL CASE_UUID --apply --identity-verified --quiesced
```

The command atomically replaces the password with a library-generated hash of a cryptographically random, undisclosed value; removes encrypted MFA secrets and recovery codes; disables MFA; deletes existing sessions and their proof; deletes account-bound stored verification records (including trusted devices, pending MFA, password reset and deletion challenges) and associated MFA attempt counters; and appends `account.mfa_recovered` as an operator event. Membership, grants, customer records and other accounts are preserved. Old password-reset links must not work. No temporary password is given to the operator or claimant.

The event's request reference is the private case UUID. A unique database index plus transaction locking prevents reusing it for another recovery. Repeating the same case for the same account returns `already-recorded` without changing credentials, even after re-enrollment; never use a new UUID just to retry uncertain output. Inspect the audit case first if commit acknowledgement is lost. Audit-write failure rolls back all changes. The CLI emits success only after commit; stdout is not a signed receipt, and an operator with database-owner privileges can bypass application safeguards.

Restore authentication ingress only after confirming the transaction outcome and the completed link-expiry wait. Guide the verified claimant to request a **new** normal password-reset email, choose a new password and sign in. With the admin MFA policy on, customer/account setup remains reachable while administration stays denied. The claimant enrolls a new authenticator, saves new recovery codes privately and verifies administrative access. Do not handle their codes or password. Record successful completion and independent notification in the private case; inspect the reference-only event in the owner audit portal. Failure to complete enrollment means recovery is still operationally incomplete.

If the command fails, preserve evidence and diagnose privately; do not improvise SQL changes or weaken MFA. Recheck quiescence before any retry. Old stateless tokens, external mailbox access, copied backups/logs and unrelated providers are outside the CLI's revocation scope. Hosted routing, real email delivery, human identity verification and downtime procedures still need client-specific acceptance.

## Evidence and references

The isolated PostgreSQL test invokes the actual CLI and real Better Auth flows. It covers read-only preview, invalid/missing attestations, wrong identity, unverified/unenrolled/linked-account rejection, audit-failure rollback, redacted errors, concurrent same-case application, replay after re-enrollment, unrelated-record preservation, old-cookie/password/challenge/reset rejection and new password/MFA recovery under the admin policy. The offline pause and identity checks cannot be established by that test. No real client account or external mail is used.

[OWASP MFA recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html) informed the independent identity checks and avoidance of an easier factor-reset path. The installed Better Auth source establishes this tool's storage cleanup and stateless-token boundaries; review them whenever upgrading the library.
