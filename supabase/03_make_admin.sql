-- ============================================================
-- Triple 7 Holdings — make (or remove) an admin
-- ------------------------------------------------------------
-- Admins are created HERE, in the Supabase SQL Editor, and nowhere
-- else. The website has no button for it, and no account - not even
-- another admin - can call these functions from the site.
--
-- 1. Sign up on the site as normal with the address you want to use
--    and click the link in the confirmation email.
--
--    Tip: Gmail ignores anything after a "+" in your address, so
--    yourname+admin@gmail.com arrives in the yourname@gmail.com
--    inbox but counts as a completely separate account here. That
--    keeps your admin login apart from your everyday one.
--
-- 2. Put that address in the line below and press Run.
-- ============================================================

select public.make_admin('yourname+admin@gmail.com');

-- To take admin away again (the account becomes a buyer):
-- select public.remove_admin('yourname+admin@gmail.com');

-- To see who is an admin right now:
-- select email, first_name, last_name, created_at from public.profiles where role = 'admin';
