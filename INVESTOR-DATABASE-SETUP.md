# Investor database connection

The investor frontend now uses the existing Supabase project configured in js/config.js.
Investor login/register routes and the browser auth storage key (t7.investor.auth) are separate from Trade. Supabase Auth remains a shared identity directory: the same email identifies one Supabase user. Separate passwords for the same email would require a separate Supabase project or a separate identity service.

## Activate
1. Open the configured Supabase project dashboard and SQL Editor.
2. Run supabase/04_investor_portal.sql once. It adds investor tables, a sign-up trigger, and access policies. It assumes the existing Trade schema and is_admin() function are already installed.
3. Do not rerun 01_schema.sql on a populated database: it drops Trade tables.
4. In Authentication > URL Configuration, add http://localhost:4180/investor-login.html to Redirect URLs. Add the exact investor-login.html URL on your production domain too. Set Site URL to your actual production site.
5. Keep email confirmation enabled. Configure your project's SMTP delivery as needed.
6. Register a NEW test email on investor-register.html, confirm it by email, and sign in on investor-login.html. Its application should be pending in investor_applications.
7. Approve a reviewed application using SQL Editor:
   update public.investor_applications set status='approved', reviewed_at=now() where email='YOUR_TEST_EMAIL';

### Test accounts without the email round trip

Steps 6 and 7 need a mailbox you control and a manual approval. To skip both, run supabase/06_investor_test_data.sql once instead. It creates three confirmed accounts on the @triple7.test domain, all with the password Triple7-Test!, one in each review state:

- investor1@triple7.test — approved, lands on investor-dashboard.html
- investor2@triple7.test — pending, lands on investor-pending.html
- investor3@triple7.test — rejected, lands on investor-pending.html in its contact-the-team state

It also publishes Bucklands and Longlands in investor_projects so the approved dashboard has something to list. The descriptions are the ones already on the site's own Mines pages; no funding target, allocation or return is stated, and the table has no column for one.

These accounts carry a published password, so they must not exist on a live site. 99_remove_test_data.sql removes them and the two seeded opportunities.
8. Sign in again. The dashboard reads the application and published projects from the database. It does not show fabricated balances or statements.
9. Add reviewed opportunities in investor_projects and set published=true. Approved investors can register interest; records appear in investor_interests.

## Validate permissions
Use two test investor accounts. Each must see only its own application and interests. Pending accounts must not read published projects or insert interest. Approved accounts must not change their application status. A Trade-only account must receive no investor workspace access until it has an investor application.

Existing Trade accounts can be enrolled by a trusted admin in SQL Editor by inserting an investor_applications record for their auth.users id. Investor registration does not silently convert Trade accounts. Shared Supabase identities do not by themselves authorize investor access.

## Still to connect
Private document uploads, investment balances, statements, and automatic approval notifications are not implemented. No sensitive file upload control is presented as working. Admins can review applications and interests in Supabase Table Editor; there is no investor approval UI yet.

A read-only schema check on 12 October 2026 confirmed all three investor tables exist in the configured remote project. Authentication and row-level permissions still need end-to-end validation. The new interest review migration (07_investor_interest_review.sql) has not been applied; see INVESTOR-INTEREST-SETUP.md for email and tracking activation. Never put a service-role key or database password in frontend JavaScript.
