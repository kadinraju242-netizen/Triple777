-- ============================================================
-- Triple 7 Holdings — TEST DATA
-- ------------------------------------------------------------
-- Run AFTER 01_schema.sql, in the Supabase SQL Editor.
--
-- Creates 21 test accounts, 49 lots, 38 enquiries and a few alert
-- sign-ups so every page has something to show.
--
-- Every test account uses the email domain @triple7.test and the same
-- password:
--
--        Triple7-Test!
--
--   Admin    desk+admin@triple7.test
--   Sellers  seller1@triple7.test … seller8@triple7.test   (seller1 also buys)
--   Buyers   buyer1@triple7.test  … buyer12@triple7.test   (buyer9 is suspended)
--
-- These are fake people. BEFORE THE SITE GOES LIVE run
-- 99_remove_test_data.sql — a public site with a known admin
-- password is an open door.
--
-- Dates are written relative to "now", so the dashboard charts
-- always look recent no matter when you run this.
-- ============================================================

-- Clear out a previous run of this file first.
delete from public.lot_alerts where email like '%@triple7.test';
delete from auth.users where email like '%@triple7.test';


-- ---------- Accounts ----------
-- The profile row for each one is made automatically by the trigger in 01_schema.sql.
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
  ('11111111-0000-4000-8000-000000000001'::uuid, 'desk+admin@triple7.test', '{"first_name": "Desk", "last_name": "Admin", "phone": "+27 53 000 0001", "country": "South Africa", "company": "Triple 7 Holdings", "role": "buyer"}'::jsonb, interval '120 days'),
  ('11111111-0000-4000-8000-000000000011'::uuid, 'seller1@triple7.test', '{"first_name": "Thabo", "last_name": "Mokoena", "phone": "+27 82 555 1037", "country": "South Africa", "company": "Kimberley Rough & Polished", "role": "seller"}'::jsonb, interval '110 days'),
  ('11111111-0000-4000-8000-000000000012'::uuid, 'seller2@triple7.test', '{"first_name": "Annelise", "last_name": "van der Merwe", "phone": "+27 82 555 1074", "country": "South Africa", "company": "Big Hole Diamonds", "role": "seller"}'::jsonb, interval '96 days'),
  ('11111111-0000-4000-8000-000000000013'::uuid, 'seller3@triple7.test', '{"first_name": "Sipho", "last_name": "Dlamini", "phone": "+27 82 555 1111", "country": "South Africa", "company": "Rand Bullion Traders", "role": "seller"}'::jsonb, interval '88 days'),
  ('11111111-0000-4000-8000-000000000014'::uuid, 'seller4@triple7.test', '{"first_name": "Naledi", "last_name": "Khumalo", "phone": "+27 82 555 1148", "country": "South Africa", "company": "Highveld Precious Metals", "role": "seller"}'::jsonb, interval '74 days'),
  ('11111111-0000-4000-8000-000000000015'::uuid, 'seller5@triple7.test', '{"first_name": "Pieter", "last_name": "Botha", "phone": "+27 82 555 1185", "country": "South Africa", "company": "Karoo Gem House", "role": "seller"}'::jsonb, interval '61 days'),
  ('11111111-0000-4000-8000-000000000016'::uuid, 'seller6@triple7.test', '{"first_name": "Amina", "last_name": "Mushi", "phone": "+27 82 555 1222", "country": "Tanzania", "company": "Merelani Tanzanite Co.", "role": "seller"}'::jsonb, interval '47 days'),
  ('11111111-0000-4000-8000-000000000017'::uuid, 'seller7@triple7.test', '{"first_name": "Tendai", "last_name": "Moyo", "phone": "+27 82 555 1259", "country": "Zambia", "company": "Zambezi Emerald Partners", "role": "seller"}'::jsonb, interval '33 days'),
  ('11111111-0000-4000-8000-000000000018'::uuid, 'seller8@triple7.test', '{"first_name": "Lerato", "last_name": "Nkosi", "phone": "+27 82 555 1296", "country": "South Africa", "company": "Jozi Fine Stones", "role": "seller"}'::jsonb, interval '12 days'),
  ('11111111-0000-4000-8000-000000000031'::uuid, 'buyer1@triple7.test', '{"first_name": "Kagiso", "last_name": "Molefe", "phone": "+27 71 444 2053", "country": "South Africa", "role": "buyer"}'::jsonb, interval '105 days'),
  ('11111111-0000-4000-8000-000000000032'::uuid, 'buyer2@triple7.test', '{"first_name": "Zanele", "last_name": "Mthembu", "phone": "+27 71 444 2106", "country": "South Africa", "company": "Mthembu Jewellers", "role": "buyer"}'::jsonb, interval '99 days'),
  ('11111111-0000-4000-8000-000000000033'::uuid, 'buyer3@triple7.test', '{"first_name": "Johan", "last_name": "Pretorius", "phone": "+27 71 444 2159", "country": "South Africa", "role": "buyer"}'::jsonb, interval '91 days'),
  ('11111111-0000-4000-8000-000000000034'::uuid, 'buyer4@triple7.test', '{"first_name": "Priya", "last_name": "Naidoo", "phone": "+27 71 444 2212", "country": "South Africa", "company": "Naidoo & Daughters", "role": "buyer"}'::jsonb, interval '83 days'),
  ('11111111-0000-4000-8000-000000000035'::uuid, 'buyer5@triple7.test', '{"first_name": "David", "last_name": "Cohen", "phone": "+27 71 444 2265", "country": "Belgium", "company": "Antwerp Sightholders BV", "role": "buyer"}'::jsonb, interval '70 days'),
  ('11111111-0000-4000-8000-000000000036'::uuid, 'buyer6@triple7.test', '{"first_name": "Fatima", "last_name": "Al-Sayed", "phone": "+27 71 444 2318", "country": "United Arab Emirates", "company": "Gold Souk Trading", "role": "buyer"}'::jsonb, interval '64 days'),
  ('11111111-0000-4000-8000-000000000037'::uuid, 'buyer7@triple7.test', '{"first_name": "Chipo", "last_name": "Banda", "phone": "+27 71 444 2371", "country": "Botswana", "role": "buyer"}'::jsonb, interval '52 days'),
  ('11111111-0000-4000-8000-000000000038'::uuid, 'buyer8@triple7.test', '{"first_name": "Michael", "last_name": "Okafor", "phone": "+27 71 444 2424", "country": "Nigeria", "company": "Lagos Bullion", "role": "buyer"}'::jsonb, interval '41 days'),
  ('11111111-0000-4000-8000-000000000039'::uuid, 'buyer9@triple7.test', '{"first_name": "Sarah", "last_name": "Williams", "phone": "+27 71 444 2477", "country": "United Kingdom", "role": "buyer"}'::jsonb, interval '30 days'),
  ('11111111-0000-4000-8000-000000000040'::uuid, 'buyer10@triple7.test', '{"first_name": "Wei", "last_name": "Zhang", "phone": "+27 71 444 2530", "country": "China", "company": "Shenzhen Gem Imports", "role": "buyer"}'::jsonb, interval '22 days'),
  ('11111111-0000-4000-8000-000000000041'::uuid, 'buyer11@triple7.test', '{"first_name": "Busisiwe", "last_name": "Zulu", "phone": "+27 71 444 2583", "country": "South Africa", "role": "buyer"}'::jsonb, interval '9 days'),
  ('11111111-0000-4000-8000-000000000042'::uuid, 'buyer12@triple7.test', '{"first_name": "Liam", "last_name": "O''Connor", "phone": "+27 71 444 2636", "country": "Ireland", "role": "buyer"}'::jsonb, interval '3 days')
) as u(id, email, meta, age);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
       'email', u.created_at, u.created_at, u.created_at
from auth.users u where u.email like '%@triple7.test';

-- Profiles should show the date the account was opened, not today.
update public.profiles p set created_at = u.created_at
from auth.users u where u.id = p.id and u.email like '%@triple7.test';

-- The admin. This is the same call you use to make a real one.
select public.make_admin('desk+admin@triple7.test');

update public.profiles set status = 'suspended' where email = 'buyer9@triple7.test';

-- One account that both buys and sells, to show that it works.
update public.profiles set is_buyer = true where email = 'seller1@triple7.test';

-- ---------- Lots ----------
-- lot_id (D-3001 …) is filled in by the database.
insert into public.lots (id, seller_id, commodity, name, type, description, price_zar, weight, weight_unit,
                         quantity, origin, specs, status, review_note, image, image_card, image_alt, created_at)
values
  ('22222222-0000-4000-8000-000000000001', '11111111-0000-4000-8000-000000000013', 'gold', '1 kg 24K Gold Bar', 'Bar', 'Gold Bar, 24K (999.9) purity, 1 kg total weight. Assay: Rand Refinery.', 1524250.00, 1000, 'g', 1, 'South Africa', '{"purity": "24K (999.9)", "certificate": "Rand Refinery"}'::jsonb, 'live', null, 'images/lots/G-2201.jpg', 'images/lots/G-2201-card.jpg', '1 kg 24K Gold Bar', now() - interval '6 days 11 hours'),
  ('22222222-0000-4000-8000-000000000002', '11111111-0000-4000-8000-000000000017', 'emerald', '0.95 ct Pear Emerald', 'Cut', 'Vivid green emerald, eye clean, cut pear. Treatment: none.', 104500.00, 0.95, 'ct', 1, 'Zambia', '{"shape": "Pear", "colour": "Vivid green", "clarity": "Eye clean", "treatment": "None", "certificate": "GIA"}'::jsonb, 'live', null, null, null, null, now() - interval '32 days 16 hours'),
  ('22222222-0000-4000-8000-000000000003', '11111111-0000-4000-8000-000000000014', 'gold', '250 g 24K Gold Bar', 'Bar', 'Gold Bar, 24K (999.9) purity, 250 g total weight. Assay: LBMA refiner.', 381060.00, 250, 'g', 1, 'Switzerland', '{"purity": "24K (999.9)", "certificate": "LBMA refiner"}'::jsonb, 'rejected', 'We need a grading report or assay before a lot of this value can list.', null, null, null, now() - interval '55 days 4 hours'),
  ('22222222-0000-4000-8000-000000000004', '11111111-0000-4000-8000-000000000015', 'ruby', '1.08 ct Cushion Ruby', 'Cut', 'Red ruby, slightly included, cut cushion. Treatment: heated.', 45400.00, 1.08, 'ct', 1, 'Mozambique', '{"shape": "Cushion", "colour": "Red", "clarity": "Slightly included", "treatment": "Heated", "certificate": "GIA"}'::jsonb, 'withdrawn', null, null, null, null, now() - interval '60 days 21 hours'),
  ('22222222-0000-4000-8000-000000000005', '11111111-0000-4000-8000-000000000015', 'sapphire', '1.12 ct Round Sapphire', 'Cut', 'Blue sapphire, slightly included, cut round. Treatment: heated.', 19000.00, 1.12, 'ct', 1, 'Madagascar', '{"shape": "Round", "colour": "Blue", "clarity": "Slightly included", "treatment": "Heated", "certificate": "GIA"}'::jsonb, 'rejected', 'We need a grading report or assay before a lot of this value can list.', null, null, null, now() - interval '50 days 0 hours'),
  ('22222222-0000-4000-8000-000000000006', '11111111-0000-4000-8000-000000000014', 'gold', '55.2 g 24K Gold Granules', 'Dust / granules', 'Gold Granules, 24K (999.9) purity, 55.2 g total weight. Assay: Independent assay.', 82460.00, 55.2, 'g', 1, 'Ghana', '{"purity": "24K (999.9)", "certificate": "Independent assay"}'::jsonb, 'live', null, null, null, null, now() - interval '45 days 16 hours'),
  ('22222222-0000-4000-8000-000000000007', '11111111-0000-4000-8000-000000000016', 'tanzanite', '4.12 ct Cushion Tanzanite', 'Cut', 'Vivid violet-blue (AAAA) tanzanite, eye clean, cut cushion. Treatment: heated.', 51500.00, 4.12, 'ct', 1, 'Tanzania', '{"shape": "Cushion", "colour": "Vivid violet-blue (AAAA)", "clarity": "Eye clean", "treatment": "Heated", "certificate": "GIA"}'::jsonb, 'sold', null, null, null, null, now() - interval '46 days 5 hours'),
  ('22222222-0000-4000-8000-000000000008', '11111111-0000-4000-8000-000000000011', 'diamond', '2.03 ct Cushion Diamond', 'Polished', 'Natural cushion diamond, G colour, VS2 clarity. Graded by GIA; the report travels with the stone.', 361100.00, 2.03, 'ct', 1, 'South Africa', '{"shape": "Cushion", "colour": "G", "clarity": "VS2", "cut_grade": "Very Good", "certificate": "GIA"}'::jsonb, 'live', null, 'images/lots/D-1055.jpg', 'images/lots/D-1055-card.jpg', '2.03 ct Cushion Diamond', now() - interval '41 days 2 hours'),
  ('22222222-0000-4000-8000-000000000009', '11111111-0000-4000-8000-000000000015', 'ruby', '0.86 ct Round Ruby', 'Cut', 'Red ruby, eye clean, cut round. Treatment: none.', 58500.00, 0.86, 'ct', 1, 'Mozambique', '{"shape": "Round", "colour": "Red", "clarity": "Eye clean", "treatment": "None", "certificate": "GIA"}'::jsonb, 'live', null, null, null, null, now() - interval '34 days 9 hours'),
  ('22222222-0000-4000-8000-000000000010', '11111111-0000-4000-8000-000000000017', 'emerald', '5.10 ct Emerald Emerald', 'Cut', 'Bluish green emerald, moderately included, cut emerald. Treatment: moderate oil.', 96900.00, 5.1, 'ct', 1, 'Zambia', '{"shape": "Emerald", "colour": "Bluish green", "clarity": "Moderately included", "treatment": "Moderate oil", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '20 days 17 hours'),
  ('22222222-0000-4000-8000-000000000011', '11111111-0000-4000-8000-000000000016', 'tanzanite', '22.00 ct Rough Tanzanite', 'Rough', 'Light violet (A) tanzanite, moderately included, rough crystal. Treatment: unheated.', 33000.00, 22, 'ct', 1, 'Tanzania', '{"shape": "Rough / uncut", "colour": "Light violet (A)", "clarity": "Moderately included", "treatment": "Unheated", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '46 days 18 hours'),
  ('22222222-0000-4000-8000-000000000012', '11111111-0000-4000-8000-000000000012', 'diamond', '0.72 ct Pear Diamond', 'Polished', 'Natural pear diamond, G colour, VS1 clarity. Graded by EGL; the report travels with the stone.', 97000.00, 0.72, 'ct', 1, 'South Africa', '{"shape": "Pear", "colour": "G", "clarity": "VS1", "cut_grade": "Good", "certificate": "EGL"}'::jsonb, 'pending', null, null, null, null, now() - interval '3 days 2 hours'),
  ('22222222-0000-4000-8000-000000000013', '11111111-0000-4000-8000-000000000017', 'emerald', '1.30 ct Oval Emerald', 'Cut', 'Green emerald, moderately included, cut oval. Treatment: moderate oil.', 33800.00, 1.3, 'ct', 1, 'Zambia', '{"shape": "Oval", "colour": "Green", "clarity": "Moderately included", "treatment": "Moderate oil", "certificate": "IGI"}'::jsonb, 'withdrawn', null, null, null, null, now() - interval '12 days 12 hours'),
  ('22222222-0000-4000-8000-000000000014', '11111111-0000-4000-8000-000000000013', 'gold', '100 g 24K Gold Bar', 'Bar', 'Gold Bar, 24K (999.9) purity, 100 g total weight. Assay: Rand Refinery.', 152420.00, 100, 'g', 1, 'South Africa', '{"purity": "24K (999.9)", "certificate": "Rand Refinery"}'::jsonb, 'pending', null, null, null, null, now() - interval '4 days 4 hours'),
  ('22222222-0000-4000-8000-000000000015', '11111111-0000-4000-8000-000000000013', 'platinum', '100 g Platinum Grain', 'Grain', 'Platinum grain at 999.5 fineness, 100 g.', 60970.00, 100, 'g', 1, 'South Africa', '{"purity": "999.5", "certificate": "Independent assay"}'::jsonb, 'pending', null, null, null, null, now() - interval '4 days 9 hours'),
  ('22222222-0000-4000-8000-000000000016', '11111111-0000-4000-8000-000000000013', 'gold', '311.035 g 22K Gold Coins', 'Coin', 'Gold Coins, 22K (916) purity, 311.035 g total weight. Assay: Rand Refinery.', 434650.00, 311.035, 'g', 10, 'South Africa', '{"purity": "22K (916)", "certificate": "Rand Refinery"}'::jsonb, 'live', null, null, null, null, now() - interval '72 days 13 hours'),
  ('22222222-0000-4000-8000-000000000017', '11111111-0000-4000-8000-000000000015', 'sapphire', '3.02 ct Cushion Sapphire', 'Cut', 'Royal blue sapphire, eye clean, cut cushion. Treatment: heated.', 157000.00, 3.02, 'ct', 1, 'Madagascar', '{"shape": "Cushion", "colour": "Royal blue", "clarity": "Eye clean", "treatment": "Heated", "certificate": "GRS"}'::jsonb, 'live', null, null, null, null, now() - interval '48 days 1 hours'),
  ('22222222-0000-4000-8000-000000000018', '11111111-0000-4000-8000-000000000014', 'gold', '86.4 g 22K Gold Nuggets', 'Nugget', 'Gold Nuggets, 22K (916) purity, 86.4 g total weight. Assay: Independent assay.', 118540.00, 86.4, 'g', 3, 'South Africa', '{"purity": "22K (916)", "certificate": "Independent assay"}'::jsonb, 'rejected', 'Weight and description do not match. Please check and submit again.', null, null, null, now() - interval '25 days 11 hours'),
  ('22222222-0000-4000-8000-000000000019', '11111111-0000-4000-8000-000000000015', 'ruby', '2.14 ct Oval Ruby', 'Cut', 'Pigeon blood red ruby, eye clean, cut oval. Treatment: heated.', 203300.00, 2.14, 'ct', 1, 'Mozambique', '{"shape": "Oval", "colour": "Pigeon blood red", "clarity": "Eye clean", "treatment": "Heated", "certificate": "GRS"}'::jsonb, 'rejected', 'Duplicate of a lot you already have listed.', null, null, null, now() - interval '21 days 13 hours'),
  ('22222222-0000-4000-8000-000000000020', '11111111-0000-4000-8000-000000000018', 'ruby', '3.40 ct Oval Ruby', 'Cut', 'Pinkish red ruby, moderately included, cut oval. Treatment: none.', 61200.00, 3.4, 'ct', 1, 'Tanzania', '{"shape": "Oval", "colour": "Pinkish red", "clarity": "Moderately included", "treatment": "None", "certificate": "None"}'::jsonb, 'pending', null, null, null, null, now() - interval '6 days 8 hours'),
  ('22222222-0000-4000-8000-000000000021', '11111111-0000-4000-8000-000000000012', 'diamond', '3.10 ct Oval Diamond', 'Polished', 'Natural oval diamond, H colour, SI1 clarity. Graded by IGI; the report travels with the stone.', 492300.00, 3.1, 'ct', 1, 'South Africa', '{"shape": "Oval", "colour": "H", "clarity": "SI1", "cut_grade": "Very Good", "certificate": "IGI"}'::jsonb, 'sold', null, null, null, null, now() - interval '7 days 20 hours'),
  ('22222222-0000-4000-8000-000000000022', '11111111-0000-4000-8000-000000000018', 'diamond', '4.25 ct Marquise Diamond', 'Polished', 'Natural marquise diamond, J colour, VS2 clarity. Graded by HRD; the report travels with the stone.', 679800.00, 4.25, 'ct', 1, 'South Africa', '{"shape": "Marquise", "colour": "J", "clarity": "VS2", "cut_grade": "Very Good", "certificate": "HRD"}'::jsonb, 'pending', null, null, null, null, now() - interval '2 days 2 hours'),
  ('22222222-0000-4000-8000-000000000023', '11111111-0000-4000-8000-000000000014', 'silver', '1 kg Silver Bar', 'Bar', 'Silver bar at 999 fineness, 1 kg total.', 21480.00, 1000, 'g', 1, 'South Africa', '{"purity": "999", "certificate": "Rand Refinery"}'::jsonb, 'live', null, null, null, null, now() - interval '7 days 20 hours'),
  ('22222222-0000-4000-8000-000000000024', '11111111-0000-4000-8000-000000000011', 'diamond', '48.6 ct Rough Diamond Parcel', 'Rough', 'Mixed rough parcel, mostly sawables in the 1–3 ct range. Sold as one parcel with Kimberley Process certificate.', 1650000.00, 48.6, 'ct', 31, 'South Africa', '{"shape": "Rough / uncut", "colour": "Mixed", "clarity": "Mixed", "cut_grade": "Not graded", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '66 days 0 hours'),
  ('22222222-0000-4000-8000-000000000025', '11111111-0000-4000-8000-000000000012', 'diamond', '12.4 ct Rough Diamond Parcel', 'Rough', 'Small rough parcel from alluvial diggings. Makeable shapes, some coated stones.', 372000.00, 12.4, 'ct', 9, 'South Africa', '{"shape": "Rough / uncut", "colour": "Mixed", "clarity": "Mixed", "cut_grade": "Not graded", "certificate": "None"}'::jsonb, 'withdrawn', null, null, null, null, now() - interval '8 days 2 hours'),
  ('22222222-0000-4000-8000-000000000026', '11111111-0000-4000-8000-000000000016', 'tanzanite', '2.36 ct Oval Tanzanite', 'Cut', 'Violet-blue (AAA) tanzanite, eye clean, cut oval. Treatment: heated.', 19400.00, 2.36, 'ct', 1, 'Tanzania', '{"shape": "Oval", "colour": "Violet-blue (AAA)", "clarity": "Eye clean", "treatment": "Heated", "certificate": "IGI"}'::jsonb, 'live', null, null, null, null, now() - interval '22 days 21 hours'),
  ('22222222-0000-4000-8000-000000000027', '11111111-0000-4000-8000-000000000014', 'platinum', '500 g Platinum Bar', 'Bar', 'Platinum bar at 999.5 fineness, 500 g.', 304850.00, 500, 'g', 1, 'South Africa', '{"purity": "999.5", "certificate": "LBMA refiner"}'::jsonb, 'live', null, null, null, null, now() - interval '62 days 9 hours'),
  ('22222222-0000-4000-8000-000000000028', '11111111-0000-4000-8000-000000000014', 'silver', '622.07 g Silver Coins', 'Coin', 'Silver coin at 999 fineness, 622.07 g total.', 13360.00, 622.07, 'g', 20, 'Canada', '{"purity": "999", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '36 days 15 hours'),
  ('22222222-0000-4000-8000-000000000029', '11111111-0000-4000-8000-000000000011', 'diamond', '1.52 ct Round Brilliant Diamond', 'Polished', 'Natural round brilliant diamond, F colour, VS1 clarity. Graded by GIA; the report travels with the stone.', 303700.00, 1.52, 'ct', 1, 'South Africa', '{"shape": "Round Brilliant", "colour": "F", "clarity": "VS1", "cut_grade": "Excellent", "certificate": "GIA"}'::jsonb, 'live', null, 'images/lots/D-1048.jpg', 'images/lots/D-1048-card.jpg', '1.52 ct Round Brilliant Diamond', now() - interval '70 days 10 hours'),
  ('22222222-0000-4000-8000-000000000030', '11111111-0000-4000-8000-000000000016', 'tanzanite', '7.80 ct Pear Tanzanite', 'Cut', 'Violet-blue (AAA) tanzanite, slightly included, cut pear. Treatment: heated.', 57700.00, 7.8, 'ct', 1, 'Tanzania', '{"shape": "Pear", "colour": "Violet-blue (AAA)", "clarity": "Slightly included", "treatment": "Heated", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '46 days 7 hours'),
  ('22222222-0000-4000-8000-000000000031', '11111111-0000-4000-8000-000000000018', 'silver', '2.3 kg Silver Jewellery', 'Jewellery', 'Silver jewellery at 925 fineness, 2.3 kg total.', 45740.00, 2300, 'g', 64, 'South Africa', '{"purity": "925", "certificate": "None"}'::jsonb, 'pending', null, null, null, null, now() - interval '3 days 23 hours'),
  ('22222222-0000-4000-8000-000000000032', '11111111-0000-4000-8000-000000000015', 'diamond', '1.75 ct Radiant Diamond', 'Polished', 'Natural radiant diamond, I colour, SI2 clarity. Not yet certified — grading is the seller’s own.', 146800.00, 1.75, 'ct', 1, 'South Africa', '{"shape": "Radiant", "colour": "I", "clarity": "SI2", "cut_grade": "Good", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '27 days 1 hours'),
  ('22222222-0000-4000-8000-000000000033', '11111111-0000-4000-8000-000000000017', 'emerald', '38.00 ct Rough Emerald', 'Rough', 'Green emerald, heavily included, rough crystal. Treatment: none.', 91200.00, 38, 'ct', 1, 'Zambia', '{"shape": "Rough / uncut", "colour": "Green", "clarity": "Heavily included", "treatment": "None", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '32 days 12 hours'),
  ('22222222-0000-4000-8000-000000000034', '11111111-0000-4000-8000-000000000012', 'diamond', '1.20 ct Emerald Diamond', 'Polished', 'Natural emerald diamond, D colour, IF clarity. Graded by GIA; the report travels with the stone.', 375500.00, 1.2, 'ct', 1, 'South Africa', '{"shape": "Emerald", "colour": "D", "clarity": "IF", "cut_grade": "Excellent", "certificate": "GIA"}'::jsonb, 'live', null, null, null, null, now() - interval '32 days 15 hours'),
  ('22222222-0000-4000-8000-000000000035', '11111111-0000-4000-8000-000000000017', 'emerald', '2.75 ct Emerald Emerald', 'Cut', 'Vivid green emerald, slightly included, cut emerald. Treatment: minor oil.', 203500.00, 2.75, 'ct', 1, 'Zambia', '{"shape": "Emerald", "colour": "Vivid green", "clarity": "Slightly included", "treatment": "Minor oil", "certificate": "GRS"}'::jsonb, 'live', null, null, null, null, now() - interval '32 days 13 hours'),
  ('22222222-0000-4000-8000-000000000036', '11111111-0000-4000-8000-000000000018', 'diamond', '1.01 ct Round Brilliant Diamond', 'Polished', 'Natural round brilliant diamond, E colour, VS1 clarity. Graded by GIA; the report travels with the stone.', 192200.00, 1.01, 'ct', 1, 'South Africa', '{"shape": "Round Brilliant", "colour": "E", "clarity": "VS1", "cut_grade": "Excellent", "certificate": "GIA"}'::jsonb, 'pending', null, null, null, null, now() - interval '0 days 0 hours'),
  ('22222222-0000-4000-8000-000000000037', '11111111-0000-4000-8000-000000000018', 'gold', '640 g 9K Gold Scrap Lot', 'Scrap', 'Gold Scrap Lot, 9K (375) purity, 640 g total weight. Assay: Independent assay.', 365860.00, 640, 'g', 1, 'South Africa', '{"purity": "9K (375)", "certificate": "Independent assay"}'::jsonb, 'pending', null, null, null, null, now() - interval '1 days 15 hours'),
  ('22222222-0000-4000-8000-000000000038', '11111111-0000-4000-8000-000000000013', 'silver', '5 kg Silver Bar', 'Bar', 'Silver bar at 999 fineness, 5 kg total.', 107390.00, 5000, 'g', 5, 'South Africa', '{"purity": "999", "certificate": "LBMA refiner"}'::jsonb, 'live', null, null, null, null, now() - interval '64 days 12 hours'),
  ('22222222-0000-4000-8000-000000000039', '11111111-0000-4000-8000-000000000018', 'sapphire', '2.20 ct Pear Sapphire', 'Cut', 'Pink sapphire, slightly included, cut pear. Treatment: heated.', 46200.00, 2.2, 'ct', 1, 'Madagascar', '{"shape": "Pear", "colour": "Pink", "clarity": "Slightly included", "treatment": "Heated", "certificate": "IGI"}'::jsonb, 'pending', null, null, null, null, now() - interval '3 days 11 hours'),
  ('22222222-0000-4000-8000-000000000040', '11111111-0000-4000-8000-000000000016', 'tanzanite', '1.45 ct Round Tanzanite', 'Cut', 'Blue-violet (AA) tanzanite, eye clean, cut round. Treatment: heated.', 6700.00, 1.45, 'ct', 1, 'Tanzania', '{"shape": "Round", "colour": "Blue-violet (AA)", "clarity": "Eye clean", "treatment": "Heated", "certificate": "None"}'::jsonb, 'live', null, null, null, null, now() - interval '34 days 6 hours'),
  ('22222222-0000-4000-8000-000000000041', '11111111-0000-4000-8000-000000000011', 'diamond', '0.91 ct Princess Diamond', 'Polished', 'Natural princess diamond, E colour, VVS2 clarity. Graded by GIA; the report travels with the stone.', 184700.00, 0.91, 'ct', 1, 'South Africa', '{"shape": "Princess", "colour": "E", "clarity": "VVS2", "cut_grade": "Excellent", "certificate": "GIA"}'::jsonb, 'sold', null, null, null, null, now() - interval '52 days 15 hours'),
  ('22222222-0000-4000-8000-000000000042', '11111111-0000-4000-8000-000000000015', 'sapphire', '1.65 ct Oval Sapphire', 'Cut', 'Cornflower blue sapphire, eye clean, cut oval. Treatment: none.', 145200.00, 1.65, 'ct', 1, 'Sri Lanka', '{"shape": "Oval", "colour": "Cornflower blue", "clarity": "Eye clean", "treatment": "None", "certificate": "SSEF"}'::jsonb, 'live', null, null, null, null, now() - interval '57 days 17 hours'),
  ('22222222-0000-4000-8000-000000000043', '11111111-0000-4000-8000-000000000014', 'platinum', '31.103 g Platinum Coin', 'Coin', 'Platinum coin at 999.5 fineness, 31.103 g.', 18960.00, 31.103, 'g', 1, 'South Africa', '{"purity": "999.5", "certificate": "Rand Refinery"}'::jsonb, 'live', null, null, null, null, now() - interval '53 days 14 hours'),
  ('22222222-0000-4000-8000-000000000044', '11111111-0000-4000-8000-000000000013', 'gold', '412 g 18K Gold Jewellery Lot', 'Jewellery', 'Gold Jewellery Lot, 18K (750) purity, 412 g total weight. No assay certificate.', 471040.00, 412, 'g', 27, 'South Africa', '{"purity": "18K (750)", "certificate": "None"}'::jsonb, 'pending', null, null, null, null, now() - interval '4 days 19 hours'),
  ('22222222-0000-4000-8000-000000000045', '11111111-0000-4000-8000-000000000018', 'sapphire', '4.80 ct Oval Sapphire', 'Cut', 'Yellow sapphire, eye clean, cut oval. Treatment: heated.', 45600.00, 4.8, 'ct', 1, 'Sri Lanka', '{"shape": "Oval", "colour": "Yellow", "clarity": "Eye clean", "treatment": "Heated", "certificate": "None"}'::jsonb, 'pending', null, null, null, null, now() - interval '2 days 23 hours'),
  ('22222222-0000-4000-8000-000000000046', '11111111-0000-4000-8000-000000000018', 'platinum', '74 g Platinum Jewellery', 'Jewellery', 'Platinum jewellery at 950 fineness, 74 g.', 42880.00, 74, 'g', 8, 'South Africa', '{"purity": "950", "certificate": "None"}'::jsonb, 'pending', null, null, null, null, now() - interval '2 days 11 hours'),
  ('22222222-0000-4000-8000-000000000047', '11111111-0000-4000-8000-000000000016', 'tanzanite', '10.50 ct Emerald Tanzanite', 'Cut', 'Vivid violet-blue (AAAA) tanzanite, eye clean, cut emerald. Treatment: heated.', 168000.00, 10.5, 'ct', 1, 'Tanzania', '{"shape": "Emerald", "colour": "Vivid violet-blue (AAAA)", "clarity": "Eye clean", "treatment": "Heated", "certificate": "GIA"}'::jsonb, 'live', null, null, null, null, now() - interval '41 days 5 hours'),
  ('22222222-0000-4000-8000-000000000048', '11111111-0000-4000-8000-000000000013', 'silver', '800 g Silver Grain', 'Grain', 'Silver grain at 999 fineness, 800 g total.', 17180.00, 800, 'g', 1, 'South Africa', '{"purity": "999", "certificate": "Independent assay"}'::jsonb, 'live', null, null, null, null, now() - interval '8 days 10 hours'),
  ('22222222-0000-4000-8000-000000000049', '11111111-0000-4000-8000-000000000014', 'gold', '31.103 g 22K Krugerrand Gold Coin', 'Coin', 'Krugerrand Gold Coin, 22K (916) purity, 31.103 g total weight. Assay: Rand Refinery.', 43460.00, 31.103, 'g', 1, 'South Africa', '{"purity": "22K (916)", "certificate": "Rand Refinery"}'::jsonb, 'live', null, null, null, null, now() - interval '44 days 11 hours');

-- Reviewed lots: say which admin reviewed them and when.
update public.lots set reviewed_by = '11111111-0000-4000-8000-000000000001', reviewed_at = least(now(), created_at + interval '9 hours')
where status <> 'pending' and seller_id in (select id from public.profiles where email like '%@triple7.test');

-- ---------- Seller documents ----------
-- One empty document was created with each lot. Mark them the way an admin would have.
update public.seller_documents d set status = 'approved', reviewed_by = l.reviewed_by, reviewed_at = l.reviewed_at
from public.lots l where l.id = d.lot_id and l.status in ('live', 'sold', 'withdrawn')
  and l.seller_id in (select id from public.profiles where email like '%@triple7.test');
update public.seller_documents d set status = 'rejected', review_note = 'Document was blank.',
       reviewed_by = l.reviewed_by, reviewed_at = l.reviewed_at
from public.lots l where l.id = d.lot_id and l.status = 'rejected'
  and l.seller_id in (select id from public.profiles where email like '%@triple7.test');

-- ---------- Enquiries ----------
insert into public.enquiries (lot_id, buyer_id, buyer_name, buyer_email, buyer_phone, message, status, created_at)
select e.lot_id, p.id, trim(p.first_name || ' ' || p.last_name), p.email, p.phone, e.message, e.status, now() - e.age
from (values
  ('22222222-0000-4000-8000-000000000042'::uuid, '11111111-0000-4000-8000-000000000036'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'answered', interval '45 days 9 hours'),
  ('22222222-0000-4000-8000-000000000038'::uuid, '11111111-0000-4000-8000-000000000031'::uuid, 'Is this still available? I can pay by EFT this week.', 'answered', interval '37 days 22 hours'),
  ('22222222-0000-4000-8000-000000000043'::uuid, '11111111-0000-4000-8000-000000000035'::uuid, 'What is your best price if I take it this month?', 'closed', interval '30 days 3 hours'),
  ('22222222-0000-4000-8000-000000000008'::uuid, '11111111-0000-4000-8000-000000000036'::uuid, 'I am interested. Please call me to discuss.', 'answered', interval '28 days 20 hours'),
  ('22222222-0000-4000-8000-000000000009'::uuid, '11111111-0000-4000-8000-000000000037'::uuid, 'Do you ship insured to my country, and what would that cost?', 'new', interval '28 days 19 hours'),
  ('22222222-0000-4000-8000-000000000049'::uuid, '11111111-0000-4000-8000-000000000035'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'answered', interval '27 days 18 hours'),
  ('22222222-0000-4000-8000-000000000017'::uuid, '11111111-0000-4000-8000-000000000038'::uuid, 'Is this still available? I can pay by EFT this week.', 'new', interval '24 days 21 hours'),
  ('22222222-0000-4000-8000-000000000008'::uuid, '11111111-0000-4000-8000-000000000033'::uuid, 'I am interested. Please call me to discuss.', 'answered', interval '24 days 0 hours'),
  ('22222222-0000-4000-8000-000000000038'::uuid, '11111111-0000-4000-8000-000000000037'::uuid, 'Is this still available? I can pay by EFT this week.', 'new', interval '23 days 3 hours'),
  ('22222222-0000-4000-8000-000000000028'::uuid, '11111111-0000-4000-8000-000000000040'::uuid, 'Would you consider selling part of the lot?', 'new', interval '21 days 20 hours'),
  ('22222222-0000-4000-8000-000000000047'::uuid, '11111111-0000-4000-8000-000000000040'::uuid, 'What is your best price if I take it this month?', 'new', interval '21 days 5 hours'),
  ('22222222-0000-4000-8000-000000000049'::uuid, '11111111-0000-4000-8000-000000000040'::uuid, 'Could you send the grading report and a video of the stone?', 'new', interval '17 days 22 hours'),
  ('22222222-0000-4000-8000-000000000041'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'Please confirm the exact weight and whether VAT is included.', 'closed', interval '17 days 14 hours'),
  ('22222222-0000-4000-8000-000000000042'::uuid, '11111111-0000-4000-8000-000000000040'::uuid, 'Could you send the grading report and a video of the stone?', 'closed', interval '16 days 2 hours'),
  ('22222222-0000-4000-8000-000000000008'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'Do you ship insured to my country, and what would that cost?', 'new', interval '15 days 18 hours'),
  ('22222222-0000-4000-8000-000000000027'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'new', interval '14 days 3 hours'),
  ('22222222-0000-4000-8000-000000000040'::uuid, '11111111-0000-4000-8000-000000000035'::uuid, 'Would you consider selling part of the lot?', 'new', interval '12 days 21 hours'),
  ('22222222-0000-4000-8000-000000000040'::uuid, '11111111-0000-4000-8000-000000000036'::uuid, 'I am interested. Please call me to discuss.', 'answered', interval '9 days 14 hours'),
  ('22222222-0000-4000-8000-000000000048'::uuid, '11111111-0000-4000-8000-000000000031'::uuid, 'Would you consider selling part of the lot?', 'new', interval '8 days 23 hours'),
  ('22222222-0000-4000-8000-000000000034'::uuid, '11111111-0000-4000-8000-000000000041'::uuid, 'Could you send the grading report and a video of the stone?', 'closed', interval '8 days 10 hours'),
  ('22222222-0000-4000-8000-000000000024'::uuid, '11111111-0000-4000-8000-000000000041'::uuid, 'What is your best price if I take it this month?', 'new', interval '7 days 19 hours'),
  ('22222222-0000-4000-8000-000000000048'::uuid, '11111111-0000-4000-8000-000000000037'::uuid, 'Is this still available? I can pay by EFT this week.', 'answered', interval '7 days 10 hours'),
  ('22222222-0000-4000-8000-000000000023'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'Can you hold this until Friday? I would like to view it.', 'new', interval '7 days 4 hours'),
  ('22222222-0000-4000-8000-000000000038'::uuid, '11111111-0000-4000-8000-000000000041'::uuid, 'Would you consider selling part of the lot?', 'answered', interval '5 days 14 hours'),
  ('22222222-0000-4000-8000-000000000023'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'Is the price negotiable for a cash buyer?', 'answered', interval '4 days 18 hours'),
  ('22222222-0000-4000-8000-000000000028'::uuid, '11111111-0000-4000-8000-000000000041'::uuid, 'Do you ship insured to my country, and what would that cost?', 'answered', interval '4 days 12 hours'),
  ('22222222-0000-4000-8000-000000000009'::uuid, '11111111-0000-4000-8000-000000000038'::uuid, 'Would you consider selling part of the lot?', 'new', interval '4 days 11 hours'),
  ('22222222-0000-4000-8000-000000000007'::uuid, '11111111-0000-4000-8000-000000000038'::uuid, 'Can you hold this until Friday? I would like to view it.', 'closed', interval '3 days 16 hours'),
  ('22222222-0000-4000-8000-000000000001'::uuid, '11111111-0000-4000-8000-000000000031'::uuid, 'Is this still available? I can pay by EFT this week.', 'new', interval '3 days 13 hours'),
  ('22222222-0000-4000-8000-000000000023'::uuid, '11111111-0000-4000-8000-000000000031'::uuid, 'Is the price negotiable for a cash buyer?', 'new', interval '3 days 7 hours'),
  ('22222222-0000-4000-8000-000000000017'::uuid, '11111111-0000-4000-8000-000000000041'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'closed', interval '3 days 5 hours'),
  ('22222222-0000-4000-8000-000000000032'::uuid, '11111111-0000-4000-8000-000000000042'::uuid, 'Please confirm the exact weight and whether VAT is included.', 'new', interval '2 days 21 hours'),
  ('22222222-0000-4000-8000-000000000035'::uuid, '11111111-0000-4000-8000-000000000040'::uuid, 'Could you send the grading report and a video of the stone?', 'new', interval '2 days 20 hours'),
  ('22222222-0000-4000-8000-000000000026'::uuid, '11111111-0000-4000-8000-000000000033'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'answered', interval '2 days 4 hours'),
  ('22222222-0000-4000-8000-000000000023'::uuid, '11111111-0000-4000-8000-000000000037'::uuid, 'Could you send the grading report and a video of the stone?', 'answered', interval '2 days 4 hours'),
  ('22222222-0000-4000-8000-000000000021'::uuid, '11111111-0000-4000-8000-000000000034'::uuid, 'I am interested. Please call me to discuss.', 'closed', interval '2 days 2 hours'),
  ('22222222-0000-4000-8000-000000000008'::uuid, '11111111-0000-4000-8000-000000000033'::uuid, 'Can you hold this until Friday? I would like to view it.', 'new', interval '0 days 13 hours'),
  ('22222222-0000-4000-8000-000000000047'::uuid, '11111111-0000-4000-8000-000000000042'::uuid, 'Can it be viewed in Johannesburg before purchase?', 'new', interval '0 days 0 hours')
) as e(lot_id, buyer_id, message, status, age)
join public.profiles p on p.id = e.buyer_id
order by e.age desc;

-- ---------- Lot alert sign-ups ----------
insert into public.lot_alerts (email, interests, created_at) values
  ('collector@triple7.test', array['diamond'], now() - interval '5 days'),
  ('bullion.desk@triple7.test', array['gold'], now() - interval '14 days'),
  ('gemhunter@triple7.test', array['diamond', 'gold'], now() - interval '23 days'),
  ('jeweller.cpt@triple7.test', array['diamond', 'gold'], now() - interval '32 days'),
  ('refinery.buyer@triple7.test', array['gold'], now() - interval '41 days'),
  ('stones.only@triple7.test', array['diamond'], now() - interval '50 days');

notify pgrst, 'reload schema';

-- Quick check: this should list the row counts.
select 'accounts' as what, count(*) from public.profiles where email like '%@triple7.test'
union all select 'lots', count(*) from public.lots
union all select 'documents', count(*) from public.seller_documents
union all select 'enquiries', count(*) from public.enquiries
union all select 'alert sign-ups', count(*) from public.lot_alerts;
