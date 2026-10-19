# Mine projects — setup and how it works

Project owners submit a full project profile; the admin team reviews it, sees an
Opportunity Score, matches it to approved investors and prints an Investment
Opportunity Brief.

## Pages

| Page | Who | Reached from |
|---|---|---|
| `project-portal.html` | Signed out: sign in / create account. Owner: their projects. Admin: review queue. | **Mine Projects** page only — "Start or Continue a Project" (top section and bottom card). Not in the navbar. Admin dashboard → **Mine Projects** tab also links here. |
| `project-profile.html` | Owner: the project profile form (draft / changes requested) or a read-only view after submitting. Admin: the review screen. | The project portal only. |

Both pages are `noindex`.

## Logins

The portal has its own browser session (`t7.project.auth`), like the investor portal,
so signing in or out here does not affect Trade or Invest. Supabase Auth keeps one
identity per email, so **any existing Triple 7 login works**: Trade buyers/sellers,
investors and admins sign in with the same email and password. New people create a
project account with just first name, surname, email and password (stored on their
`profiles` row by the existing sign-up trigger, with no buyer/seller role).

Admins are recognised the usual way: `profiles.role = 'admin'`.

## Activate

1. In the Supabase SQL Editor run `supabase/13_mine_projects.sql` (after 11). It is
   additive and safe to run again. It creates:
   - `mine_projects` — every field of the project profile, plus review fields
   - a guard trigger: owners can only edit their own draft / changes-requested
     projects, cannot set status beyond `submitted`, and cannot touch the score,
     review note or investor link; submission checks the required fields
   - row-level security: owner sees own projects, admin sees all; owners may delete
     only drafts
   - `publish_mine_project(id, minimum, publish)` — admin only; creates/updates the
     project's row in `investor_projects` (hidden unless `publish` is true), so it can
     appear on the investor dashboard and in the existing investor matching
   - a private storage bucket `project-documents` (25 MB per file; PDF, images, Word,
     Excel, CSV). Files are stored under `<user id>/<project id>/`; owners reach only
     their own folder, admins can read all
2. Authentication → URL Configuration → Redirect URLs: add
   `https://triple777-omega.vercel.app/project-portal.html` (and
   `http://localhost:4180/project-portal.html` for local testing). Sign-up
   confirmation and password-reset emails return there.

Tested against a local PostgreSQL copy of the schema (01, 04, 04_investor, 11, 13):
the migration applies twice cleanly and the owner / other-account / admin rules,
submission checks, publish function and storage policies behave as described.

## Review flow

1. The owner builds the profile in 11 steps (it saves as they move between steps) and
   submits it. From then on the owner sees **Awaiting approval**.
2. The admin opens it from the queue and makes a **decision**: In review, Request
   changes (reopens it for the owner), Approve or Decline, with a message to the owner.
   The owner sees only the outcome (Awaiting approval / Changes requested / Approved /
   Not approved) and that message — never the score, matches or any investor listing.
3. Only once a project is approved can the admin **list it for investors**. It stays
   hidden from investors until the "Show to approved investors" switch is turned on.
   Moving a project away from Approved takes the listing down again.

## Project profile (what owners fill in)

A. Project basics · B. Location (country, province, district, municipality,
coordinates, geological area) · C. Ownership (company, role, right holder,
shareholding, JV) · D. Rights & regulatory (licence/right status, reference,
environmental, water, other authorisations) · E. Stage & technical (project status,
technical status, resource, grade) · F. Production & infrastructure · G. Commercial &
offtake (offtake, CAPEX, OPEX) · H. Capital & investment requirement (capital band,
exact amount, use of funds, investor support needed, funding structure, the ask) ·
I. Management & risks · J. Documents · K. Declaration.

Required to submit: name, commodity, province/region, project status, licence/right
status, capital required, at least one type of investor support, declaration. Drafts
can be saved at any point.

## Opportunity Score (out of 100) — `js/project-scoring.js`

| Part | Max | From |
|---|---|---|
| Rights & regulatory | 25 | right status (15) + environmental (6) + water (4) |
| Technical confidence | 20 | none → feasibility study |
| Project maturity | 15 | greenfield → operational |
| Infrastructure | 10 | 2 per item on site |
| Commercial / offtake | 10 | none → signed offtake |
| Management | 10 | team in place |
| Information provided | 10 | documents (up to 5) + key details filled |

Bands: 75+ Strong · 55+ Promising · 35+ Early stage · below Needs work. The score is
saved with each admin review. Change the points in `OPTIONS` in
`js/project-scoring.js`; `tests/project-scoring.test.mjs` checks the maths.

## Match Engine

Project → capital requirement → suitable investors → suggested structure. For each
**approved** investor:

| Part | Max |
|---|---|
| Capital fit (budget vs amount required; part-funding flagged as co-investment) | 40 |
| Location fit (preferred region, then preferred country, then residence) | 25 |
| Sector fit (has chosen Mining) | 15 |
| Risk appetite vs project stage | 10 |
| Readiness (proof of funds, verification, how fast) | 10 |

The suggested structure orders the project's requested support types by the
investor's risk appetite (higher risk → equity/JV first; lower → debt / equipment /
offtake financing first). Each match has **Brief for this investor**; there is also a
general **Opportunity Brief**. The brief opens as a printable page (Print / Save as
PDF) and does not include the owner's personal contact details.

## Not done yet

- The investor registration form does not ask for preferred commodities or deal
  structures, so the match uses budget, location, sector, risk and readiness. Adding
  those two questions to `investor-register.html` would sharpen matches.
- No automatic emails when a project is submitted or reviewed; the owner sees status
  and the team's message in the portal.
- Works with the online database (Supabase) only, like the investor portal; the local
  MySQL server does not have these tables.
