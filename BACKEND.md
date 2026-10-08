# Backend — Person 2

Two interchangeable backends behind the Trade Desk. Setup steps are in `SETUP.md`.

- **MySQL** (default while `js/config.js` has no keys): `node serve.js` runs `local-db/server.js`, a small Node API on top of a normal MySQL/MariaDB database (driver: `mysql2`). Tables are in `local-db/schema.sql`. Same rules as below, enforced on the server before any SQL runs; all queries use placeholders.
- **Supabase** (Postgres + Auth): used as soon as `js/config.js` has a project URL and anon key. This is what runs online.

```
local-db/
  server.js                the MySQL-backed API and its rules
  schema.sql               the MySQL tables
  config.json              MySQL host, user, password, database
  admin.js                 make-admin / password / delete-user / reset, from the terminal
  seed.json                the test data it starts from
supabase/
  01_schema.sql            tables, triggers, row-level security, admin functions
  02_test_data.sql         21 test accounts, 49 lots, 38 enquiries
  03_make_admin.sql        the one line that makes an account an admin
  99_remove_test_data.sql  run before going live
js/
  config.js                project URL + anon key (public by design)
  auth.js                  sign in / up / out, Google, page guard
  api.js                   every database read and write goes through here
  catalog.js               the 8 commodities and the fields each one has
  vendor/supabase.js       supabase-js 2.117.3, bundled so there is no CDN dependency
```

## What changed from the earlier design

`TRADE-DESK.md` describes a sandbox sign-in and a desk with no prices. That is replaced:

| Before | Now |
|---|---|
| Sandbox sign-in, nothing checked | Supabase Auth: email + password with email confirmation, and Google |
| Trade board open to everyone | Members only. Signed-out visitors go to `signin.html` and come back |
| Diamond and gold | Diamond, gold, platinum, silver, ruby, sapphire, emerald, tanzanite |
| "Quote on request", no prices | Seller's asking price in rand |
| Quote request form emailed to the desk | Buyer sends an enquiry from the lot page; the seller sees it in their dashboard |
| Seller and buyer dashboards were demos | Real seller dashboard. Buyers use the board itself |
| No admin | `admin.html`, for accounts the database marks as admin |

`TRADE-DESK.md` argued that portals could not be secured on a static site. That was true without a backend. With Supabase the rules run in the database, not in the browser, so the page being static no longer matters: a visitor who edits the JavaScript still gets only the rows their signed-in account is allowed.

## Tables

| Table | Holds |
|---|---|
| `profiles` | one row per account: role (`buyer` / `seller` / `admin`), name, phone, country, company, status |
| `lots` | every listing: commodity, price, weight, per-commodity details in `specs` (jsonb), status |
| `seller_documents` | one supporting document per listing. Empty for now; created automatically; reviewed by an admin |
| `enquiries` | buyer → seller messages about a lot, with the buyer's contact details copied in |
| `lot_alerts` | "tell me when new lots list" emails |

Lot status: `pending` → `live` (admin approves) or `rejected`; then `sold` or `withdrawn`.

## Who can do what

| | Not signed in | Buyer | Seller | Admin |
|---|---|---|---|---|
| See live lots | no | yes | yes | yes |
| See pending / rejected lots | no | no | own only | all |
| List a lot | no | no | yes, always starts `pending` | — |
| Approve / reject / delete a lot | no | no | no | yes |
| Withdraw or mark sold | no | no | own only | yes |
| Send an enquiry | no | on live lots | no | no |
| Read enquiries | no | own | on own lots | all |
| Read other people's profiles | no | no | no | yes |
| Review documents | no | no | no | yes |
| Suspend an account | no | no | no | yes |
| Make an admin | no | no | no | **no — SQL Editor only** |
| Join the alert list | yes | yes | yes | yes |

Enforced by row-level security plus `before` triggers (`lots_guard`, `enquiries_guard`, `documents_guard`). The triggers overwrite anything a browser should not choose: a seller cannot set their own lot to `live`, a buyer cannot forge the name on an enquiry, and the role sent by the sign-up form is ignored unless it is `buyer` or `seller`.

## Tested

Run against a local Postgres 16 + Supabase Auth (GoTrue 2.170) + PostgREST 12 stack, using supabase-js:

- 52 database checks: every row of the table above from each role, sign-up with email confirmation, forged fields, suspended accounts.
- 29 browser checks: sign-up → email link → list a lot → admin approves → buyer enquires → seller answers; redirects; wrong password; tampering with the cached session.

The browser checks were also run against the MySQL backend, on both MySQL 8.0 and MariaDB 10.11 (the one XAMPP ships).

Not tested, because they need your real project: Google sign-in, and email delivery through Supabase's mailer.

## Adding to it later

- **A ninth commodity**: add it in `js/catalog.js` and to the `check` on `lots.commodity` in `01_schema.sql`.
- **Document uploads**: `seller_documents.file_name` / `file_path` are already there. Add a private Supabase Storage bucket and an upload input at step 5 of the sell form.
- **Lot photos**: `lots.image` / `image_card` are already read by the cards.
