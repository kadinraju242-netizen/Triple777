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
8. Sign in again. The dashboard reads the application and published projects from the database. It does not show fabricated balances or statements.
9. Add reviewed opportunities in investor_projects and set published=true. Approved investors can register interest; records appear in investor_interests.

## Validate permissions
Use two test investor accounts. Each must see only its own application and interests. Pending accounts must not read published projects or insert interest. Approved accounts must not change their application status. A Trade-only account must receive no investor workspace access until it has an investor application.

Existing Trade accounts can be enrolled by a trusted admin in SQL Editor by inserting an investor_applications record for their auth.users id. Investor registration does not silently convert Trade accounts. Shared Supabase identities do not by themselves authorize investor access.

## Still to connect
Private document uploads, investment balances, statements, and automatic approval notifications are not implemented. No sensitive file upload control is presented as working. Admins can review applications and interests in Supabase Table Editor; there is no investor approval UI yet.

The migration has not been executed against the remote project. Run it and test email delivery and permissions before using real applications. Never put a service-role key or database password in frontend JavaScript.
