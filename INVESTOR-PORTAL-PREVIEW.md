# Investor portal visual prototype — 9 October 2026

## Populated presentation update

The portal now uses a fictional investor, Thabo Molefe, with R750,000 allocated to Bucklands and R500,000 to Longlands. Profiles, approval dates, statements, updates, funding targets, allocations, participation amounts and milestones are illustrative mock data, not approved business information or real investor records.

Use **Enter Demo** on Invest or **Enter Demo Dashboard** on Investor Login to bypass registration. The large prototype banners have been replaced by a discreet demo label. Document buttons open sample briefs, operations reports, verification and statements in a modal. Register Interest shows a local demo confirmation and sends nothing. No real accounts, transactions or document uploads were added.

This update supersedes the earlier notes below about empty investments, missing documents and absence of funding figures. Financial sample content must be replaced with approved data before launch.

## Review the flow

Open `/investors.html` on the local preview. Register opens the intake form; Investor Login opens the login preview.

The registration form uses Sections A–E from the supplied Investor Intake Form: basic information, financial profile, investment experience, risk and commitment, and uploads. The financial brackets and choice lists match the PDF. An investor name/date acknowledgement previews its signature area; historical signatures, third-party identities, dates and personal identifiers were not copied. The title uses Triple 7 branding rather than the PDF's DITRA label.

Use fictional details and a sample document. Preview Submission takes you to Awaiting Approval. No application is actually submitted. On the pending screen, Preview Approved Dashboard demonstrates the approved state. The login page also has a Preview Approved Investor button.

The approved dashboard includes application status, available projects, a document centre, and an empty investments area. Project Opportunities shows Bucklands and Longlands, with project filtering, expandable background, and a discussion action. No financial terms or returns were invented. Documents remain marked as not supplied.

Direct visits to the dashboard or opportunities without the approved demo state return to login or the pending screen. This uses browser session state to demonstrate the workflow; it is not secure authentication or a real approval system. The demo approval buttons intentionally bypass review for design inspection. These buttons must be removed when a backend is implemented.

Most of the previous explanatory Invest content has moved to About: company overview, mine-to-market explanation, investment discussion process, information-before-commitment section and FAQs. The former enquiry form was replaced by the registration journey. Public Mines pages remain unchanged.

## Reference review

- https://www.pakhula.co.za/investors — local mining knowledge and investor entry point, with structured project descriptions elsewhere in the site.
- https://enviromine.co.za/investors — prominent investor login/register actions and controlled access to detailed materials.

The two public references informed the page hierarchy; their investment offerings and factual claims were not copied.

## Scope

No form values, passwords or selected files are stored, uploaded or sent. Only a `pending` or `approved` demo flag is kept in sessionStorage. Email discussion opens the user's email app only when they choose that link. The existing Trade account system remains separate.

Before production: implement authentication, server-enforced approval, secure document storage, application review and notifications, and approved project/document data. Decide who reviews applications and the required privacy/consent wording. This prototype is not ready to collect real personal or financial records.

## Verification

Checked JavaScript syntax, a complete fictional registration through pending state, approved dashboard navigation, signed-out and pending redirects, project filtering, discussion controls, and mobile registration/dashboard/opportunity widths at 390px. Saved desktop dashboard and mobile opportunities screenshots in `previews/`.
