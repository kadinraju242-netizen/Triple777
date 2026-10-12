-- ============================================================
-- Triple 7 Holdings — INVESTOR TEST ACCOUNTS
-- ------------------------------------------------------------
-- Run AFTER 04_investor_portal.sql, in the Supabase SQL Editor.
--
-- The investor portal has no demo bypass: investor-login.html signs
-- in against Supabase Auth and then looks for a row in
-- investor_applications. Without one it signs the account straight
-- back out. These three accounts give you one of each state so the
-- approved, pending and rejected screens can all be opened.
--
-- Every account uses the @triple7.test domain and the same password
-- as the Trade Desk test data in 02_test_data.sql:
--
--        Triple7-Test!
--
--   investor1@triple7.test   approved  -> investor-dashboard.html
--   investor2@triple7.test   pending   -> investor-pending.html
--   investor3@triple7.test   rejected  -> investor-pending.html
--                                         (shows the "contact the team" state)
--
-- These are fake people. The accounts are confirmed here directly,
-- so no confirmation email is sent and none is needed.
--
-- BEFORE THE SITE GOES LIVE run 99_remove_test_data.sql. A public
-- site with a published password is an open door.
--
-- NOTE ON CONTENT: the two seeded opportunities carry the project
-- names, locations and descriptions already published on the site's
-- own Mines pages. No funding target, allocation, return, valuation
-- or any other commercial term is invented here, and the schema has
-- no column for one. Replace this with approved material before any
-- real investor sees it.
-- ============================================================

begin;

-- Clear out a previous run of this file first.
delete from public.investor_interests
 where project_id in ('22222222-0000-4000-8000-000000000001',
                      '22222222-0000-4000-8000-000000000002');
delete from public.investor_projects
 where id in ('22222222-0000-4000-8000-000000000001',
              '22222222-0000-4000-8000-000000000002');
delete from auth.users where email in ('investor1@triple7.test',
                                       'investor2@triple7.test',
                                       'investor3@triple7.test');


-- ---------- Accounts ----------
-- "portal":"investor" is what the trigger in 04_investor_portal.sql
-- watches for; it creates the matching investor_applications row.
-- No "role" key, so these accounts get no Trade Desk buyer or seller
-- access — an investor login is not a trading login.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Triple7-Test!', extensions.gen_salt('bf')), now() - u.age,
  '{"provider":"email","providers":["email"]}'::jsonb, u.meta, now() - u.age, now() - u.age,
  '', '', '', ''
from (values
  ('11111111-0000-4000-8000-000000000101'::uuid, 'investor1@triple7.test',
   '{"portal": "investor", "full_name": "Nomsa Dube", "phone": "+27 82 555 3011", "country": "South Africa", "company": "Dube Family Office",
     "investor_application": {"capacity": "R500,000 - R1,000,000", "funds": "Own capital", "verification": "Available on request",
                              "experience": "Listed equities and property", "risk": "Medium", "timing": "Within 3 months",
                              "investment_types": ["Mining projects"], "signature": "Nomsa Dube", "signature-date": "2026-09-28"}}'::jsonb,
   interval '14 days'),
  ('11111111-0000-4000-8000-000000000102'::uuid, 'investor2@triple7.test',
   '{"portal": "investor", "full_name": "Riaan Pretorius", "phone": "+27 82 555 3042", "country": "South Africa", "company": "",
     "investor_application": {"capacity": "R100,000 - R500,000", "funds": "Own capital", "verification": "Available on request",
                              "experience": "First mining investment", "risk": "Low", "timing": "Exploring options",
                              "investment_types": ["Mining projects"], "signature": "Riaan Pretorius", "signature-date": "2026-10-06"}}'::jsonb,
   interval '5 days'),
  ('11111111-0000-4000-8000-000000000103'::uuid, 'investor3@triple7.test',
   '{"portal": "investor", "full_name": "Chipo Banda", "phone": "+260 97 555 3073", "country": "Zambia", "company": "Banda Holdings",
     "investor_application": {"capacity": "Under R100,000", "funds": "Own capital", "verification": "Not yet supplied",
                              "experience": "None", "risk": "Low", "timing": "Undecided",
                              "investment_types": ["None"], "signature": "Chipo Banda", "signature-date": "2026-09-15"}}'::jsonb,
   interval '27 days')
) as u(id, email, meta, age);


-- ---------- Review outcomes ----------
-- The trigger files everything as 'pending'; investor2 is simply left
-- that way. Approval is a review decision, so it is set here the same
-- way a reviewer would set it.
update public.investor_applications
   set status = 'approved', reviewed_at = now() - interval '9 days'
 where email = 'investor1@triple7.test';

update public.investor_applications
   set status = 'rejected', reviewed_at = now() - interval '20 days'
 where email = 'investor3@triple7.test';


-- ---------- Published opportunities ----------
-- Without these the approved dashboard loads but has nothing to list.
-- Text is taken from the site's own Bucklands and Longlands pages.
insert into public.investor_projects (id, name, description, location, published) values
  ('22222222-0000-4000-8000-000000000001', 'Bucklands Project',
   'Bucklands is a multi-farm diamond project in the Douglas area — eight farms forming a major Northern Cape opportunity for Triple 7 Mining Division.',
   'Douglas, Northern Cape', true),
  ('22222222-0000-4000-8000-000000000002', 'Longlands Project',
   'Longlands is an active diamond project with machinery already on site — positioned for working-capital support to move from mobilisation into sustained recovery.',
   'Northern Cape, South Africa', true);

commit;


-- ---------- Check ----------
select email, status, reviewed_at from public.investor_applications
 where email like '%@triple7.test' order by email;
select name, location, published from public.investor_projects order by name;
