# Investor interest review and email activation

Local code is prepared. Remote activation requires access to the Supabase project and a transactional email provider. Never place server secrets in js/config.js.

## Verified on the connected project

Read-only REST requests with limit=0 confirmed that investor_applications, investor_projects and investor_interests exist. The investor_interests.status column was missing. This checks schema availability only, not authentication, approval or row-level permissions.

## Activate

1. In the same Supabase project, run 07_investor_interest_review.sql once, after 04_investor_portal.sql. It adds received / in_discussion / closed statuses, investor-visible review notes, audit history, admin-only updates, and an email outbox. It does not reset Trade tables. Backfilled interests receive history but no retroactive email.
2. Set up a Resend account and verify a sending domain. Choose a verified sender address and the team inbox (default intended inbox: info@triple7holdings.co.za).
3. In Edge Function Secrets set RESEND_API_KEY, INVESTOR_EMAIL_FROM, INVESTOR_TEAM_EMAIL, INVESTOR_SITE_URL (the public HTTPS site URL, without a trailing slash), and INVESTOR_WORKER_TOKEN (a long randomly generated secret). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are supplied by Supabase. Keep all of these server-side.
4. Deploy supabase/functions/investor-notifications using the Supabase CLI or Dashboard. Deploy with JWT verification disabled for this one function; it requires its own x-investor-worker-token instead. The included config.toml declares that setting. Do not disable JWT verification on other functions.
5. In Supabase Vault create investor_project_url (the project's https://…supabase.co URL) and investor_worker_token (the same token as the Edge Function secret). Enable Cron, pg_net and Vault if needed, then run 08_investor_notification_schedule.sql. It invokes the worker once a minute.
6. Sign in as an approved investor and register interest in a published test project. Confirm one interest, two queue jobs, investor and team emails, and initial Received status. An existing duplicate must not generate more emails.
7. Sign in with your existing Trade admin account, open investor-review.html (linked from Admin), change status and add an investor-visible note. Reload the investor dashboard to confirm persistence. Test with another investor to confirm isolation; attempt a direct status update as an investor and confirm rejection.

## Email behavior

On a new interest, a database trigger queues an investor confirmation and a team notification transactionally. A server-only worker claims jobs with SKIP LOCKED, sends plain-text email through Resend, and stores the provider response. Retries use a stable idempotency key and stop after six attempts or 23 hours; inspect failed jobs manually. A successful provider response means accepted for sending, not confirmed delivery. Delivery/bounce webhooks are not implemented. Review status changes are visible in the dashboard; this version does not send status-change emails.

The worker obtains recipients from trusted investor records and server configuration. It does not accept browser-supplied addresses. Email bodies omit application financial details. Team review notes are investor-visible; do not enter private internal notes there.

## Dashboard behavior

My Interests shows reference, project, received date, last update, review status and team note. Existing interests are loaded on return and their Register Interest button is disabled. If the review migration is missing, the dashboard explains that tracking is being set up and prevents new submissions until the queue is available. Previously registered interests remain visible. The local demo supports all three review states and sends nothing.

Do not claim email delivery is active until the migration, worker, verified sender, secrets, schedule and end-to-end test are complete. Payments, agreements and financial reporting remain separate future work.

Official guides: https://supabase.com/docs/guides/functions/examples/send-emails and https://supabase.com/docs/guides/functions/schedule-functions.
