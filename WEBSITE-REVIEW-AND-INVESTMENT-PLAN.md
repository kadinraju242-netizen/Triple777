# Triple 7 website review and investment plan

Prepared 8 October 2026. Initial review and planning deliverable. The subsequent local implementation is documented in LOCAL-UPDATE-NOTES.md; that note reflects the owner's clarified scope and completed changes.

## Scope and evidence

Reviewed the five supplied screenshots (the third was withdrawn), the public .co.za homepage, investment, registration, login, trade and two mine pages; the .com homepage and Tender House; and the local HTML, shared styles, navigation and account code. Public page text was retrieved, not a complete browser interaction audit. No accounts were created, enquiries sent or payments tested. Accessibility, performance and mobile observations below need browser verification before being called test results.

The local build matches the screenshots but differs from the live .co.za site. The live site describes a dedicated investor portal. The local build has an informational investors.html page and buyer/seller registration, with no investor journey identified in the reviewed account code. Do not assume that a local redesign updates either live domain or that the existing live portal can be reused without checking its integration.

## Overall assessment

The visual styling has a useful foundation: restrained typography, spacious sections, and an identifiable mining business. The main weakness is decision-making. Visitors need a clear route for buying, investing, or learning about a mine, and enough specific information to choose that route. General claims and dramatic imagery currently do more work than concrete evidence.

The priority is clarity and credibility before decoration. Incorrect footprint figures, uncertain image provenance and inconsistent descriptions of project readiness can undermine an investor's confidence more than a dark colour palette.

## Desktop usability findings, ordered by priority

| Priority | Finding and evidence | Recommended change |
| --- | --- | --- |
| Critical | Screenshot and local homepage show 8 mines, 7 locations and 6 projects. The user confirms 2 mines and 2 locations. | Show only 2 mines and 2 locations. Check every related claim, including About and mine pages. Remove the projects statistic, not necessarily the project-partnership page. |
| Critical | The live investment page encourages registration and describes deposits without presenting comparable investment terms. The local page gives only governance copy and contact details. | Explain each opportunity, purpose of capital, readiness and next step before requesting an account. Define the actual investment structure before presenting an online investment action. |
| High | The live mine directory lists Bucklands and Longlands, while investment/Bucklands copy also mentions Warrenton. Longlands copy distinguishes machinery on site from sustained recovery. | Reconcile the portfolio with the confirmed two-mine scope. Use dated, approved status labels; equipment on site does not establish current production. |
| High | The screenshot heroes place large text across machinery and landscape, with a strong dark overlay. | Give text its own light panel beside a broad image. Remove the photographic shade without sacrificing text readability. |
| High | The image in the governance screenshot does not establish a South African or company location; the home image likewise needs source verification. | Use authenticated company/site photography where possible. Record source, permission, location and caption. Do not label generic stock as a Triple 7 mine. |
| High | Navigation gives separate prominence to Mines and Mine Projects, and local pages repeat Jobs. Contact/account controls vary between page templates. | Apply one shared navigation order: Home, Trade, Invest, Mines, Mine Projects, About. Keep Contact as a separate utility action. If grouped, Mines can contain Our Mines and Project Partnerships. Remove Jobs from navigation, footer and homepage links. |
| High | The .co.za Trade page text combines live lot counts with repeated Closed/Desk closed messages. | Explain whether closed means office hours, a tender window or unavailable inventory. State the next opening time and whether enquiries are still accepted. Separate listing availability from trading hours. |
| High | The two domains use different commercial models: .co.za has Trade Desk quotes; .com Tender House includes priced products and cart actions. | Decide the authoritative destination for each task. Explain any handoff between trade, manufacturing and retail; avoid making visitors discover the relationship themselves. |
| Medium | Homepage screenshot has three competing routes, including two trade-related actions with lengthy labels. | Use concise labels: Trade, Our Mines and Invest. Remove the duplicate trade action from the hero, or use Browse Lots only in the trade section. Keep destination-specific accessible labels if useful. |
| Medium | The local investor page begins with governance rather than the offer; its heading sequence goes from h1 to h3. | Start with opportunity information, then evidence and governance. Use a logical h1, h2, h3 sequence throughout. |
| Medium | Local footer social links lead to generic Instagram and LinkedIn homepages. | Replace with verified company profiles or remove the icons. A branded link should lead to the company it names. |
| Medium | Breadcrumbs add clutter to simple top-level pages and are explicitly unwanted. | Remove the visual Home / Page trails globally. Retain contextual links such as All Mines on detailed mine pages and Back to Lots on trade details. |
| Medium | Navy fills occupy large areas and small uppercase labels compete with content. | Lighten navy modestly, remove label backgrounds and decorative highlight bars, and reserve uppercase labels for short supporting text. Preserve visible keyboard focus and current-page indicators. |
| Medium | The local Contact page relies on phone/email links; the live investment page shows an enquiry form. | Provide an inline investor enquiry with an explicit success or failure state and a direct email fallback. Avoid relying exclusively on the visitor having an email application configured. |
| Medium | Governance and sourcing statements are broad and largely unsupported within the reviewed investor content. | Link dated evidence and identify leadership, ownership, reporting arrangements and document availability. Confirm State Diamond Trader relationship and permitted logo use before carrying claims into new copy. |

## Investment section: proposed content

Purpose: let a prospective investor understand Triple 7, compare the two mine opportunities, review supporting information and start a relevant conversation.

The .co.za site supplies the mine and investment context. The .com site supplies manufacturing, cutting/polishing and sales context. Together they suggest a mining-to-market narrative; they do not establish the ownership or economics of a particular investment. Do not imply that investing in a mine gives exposure to all group activities unless the agreement says so.

### 1. Hero

Use a short heading such as “Invest in South African diamond mining.” Supporting text should explain that visitors can explore the mines and discuss available partnerships. Use “View Mines” and “Enquire” as actions. Avoid “Invest Now” until terms, eligibility and the actual transaction process are defined.

Place the text on a pale background to the left, with an unshaded, high-resolution verified mine photograph taking roughly 60% of the desktop hero. Make the photo area approximately 480–620px high as an initial design target, adjusted to the source image. Keep machinery and the landscape's focal point clear of text. These are design targets, not fixed requirements for every page.

### 2. Company snapshot

Show 2 mines, 2 locations and a concise description of the company's role. Explain recovery, sorting, cutting/polishing and sales in plain language, identifying which services are operated directly and which depend on partners. Link to About and Trade for detail.

### 3. Two mine cards

Show Bucklands and Longlands with equal structure so visitors can compare them:

- Verified image and mine name.
- Location; Bucklands is described online as Douglas, Northern Cape. Longlands is described more broadly as Northern Cape and needs a confirmed locality.
- Approved operational stage and date last updated.
- Purpose of funding, if fundraising is actually open.
- Investment availability: open, by discussion or currently unavailable, only after confirmation.
- “View Mine” and “Enquire” actions, with the selected mine carried into the enquiry.

The existing sources describe Bucklands in terms of planned mobilisation and Longlands in terms of equipment on site and working-capital needs. Treat those descriptions as leads for company confirmation, not proof of current operating status or a public offer.

### 4. Opportunity detail

For each available opportunity, identify the entity receiving capital, structure offered, funding target, use of funds, minimum participation if applicable, intended milestones, time horizon, reporting and material project risks. Include fees, return/distribution mechanism, liquidity/exit restrictions and governing documents once approved. Do not invent numbers or returns to fill the layout.

Publish useful factual summaries openly. Reserve sensitive financial and technical documents for controlled access if needed. A public summary should still explain enough for someone to decide whether to enquire.

### 5. How the process works

Recommended initial journey:

Explore a mine → submit an enquiry → team confirms fit and availability → receive approved documents and discuss terms → verification and agreement → funding through the agreed process → ongoing reporting.

Account creation should happen when it has a clear benefit. Existing investors can have a quiet Investor Login utility link if the live portal is confirmed to be operational and integrated with this site. Investor accounts must be clearly distinguished from Trade buyer/seller accounts.

### 6. Evidence and governance

Identify the leadership responsible for delivery; provide dated mine updates, relevant company/ownership information, supporting project documentation and a clear contact. Include technical and financial documents only when available and authorised for release. Do not display download buttons for documents that do not exist.

### 7. FAQs

Answer: which mines are available; who can participate; what type of agreement is offered; minimum investment if defined; what funding supports; how updates are delivered; what documents are available; what happens after an enquiry; and how existing investors get assistance.

### 8. Enquiry

Required: name, email and mine/general interest. Optional: telephone, company and a short message. Keep an investment amount optional, or defer it to the discussion. Provide appropriate privacy information and separate any marketing opt-in from the enquiry itself.

Successful submission should identify the selected opportunity, confirm receipt and explain the next step. State a response timeframe only if the team can meet it. Preserve entered information after errors. Deliver to an agreed monitored inbox or lead system, with spam protection, an internal record and tested failure handling.

## Visual implementation brief

- Use real South African imagery with confirmed source and location. Original photographs are best; stock is acceptable for clearly generic supporting scenes. Do not use fabricated imagery as evidence of an operating mine.
- Improve image clarity through better source resolution and appropriate crops. Removing an overlay cannot restore detail missing from a low-resolution original.
- Create a shared split hero for photo-led public pages. Trade, account and administration screens should prioritise their task instead of gaining a large decorative hero.
- Initial navy candidates: #17365A for primary dark sections and #21466F for supporting panels. Compare these beside the current palette before finalising. Keep body text dark and links distinct on light backgrounds; verify contrast before release.
- Remove decorative navy rectangles behind words such as Investors. Retain functional button styling, focus indicators and selected states.
- Show 2 mines / 2 locations as two balanced columns; remove the Projects column entirely.
- Use the requested main navigation sequence, with About last among content links. Place Account and Contact as utility controls. Rename Investors to Invest in navigation while retaining a descriptive page title.
- Remove Careers/Jobs entry points. For a previously published jobs URL, prefer redirecting visitors to Contact rather than leaving a broken link; confirm the hosting route during implementation.
- Remove breadcrumbs in the page templates, not just through a visual hiding rule. Keep meaningful return links within detail journeys.

## Information access targets

From any public page, Trade, Invest and Mines should be available in one navigation action. From Home, a visitor should reach a specific mine within two deliberate actions. From Invest, enquiry should be directly visible and each mine's approved details should be one action away. Phone and email should remain easily available in the footer and Contact page.

Check these journeys with unfamiliar users: identify what the company does; find an available mine opportunity; explain what happens after enquiry; browse a diamond lot; understand whether a closed desk accepts enquiries; and contact the correct team. Record completion, wrong turns and points of uncertainty rather than relying on visual impressions alone.

## Delivery order

1. Confirm authoritative domain/build, the two mine records, available opportunities and investment journey.
2. Correct footprint/content contradictions and remove Jobs entry points.
3. Build Invest content and its enquiry workflow using approved facts.
4. Apply shared navigation, brighter split heroes, verified imagery, lighter navy, highlight/breadcrumb removal and short actions.
5. Verify desktop navigation, links, forms, keyboard operation and page content.
6. Perform mobile evaluation last, then correct and retest responsive behaviour.

## Mobile evaluation — final phase

Existing code contains responsive layouts, a collapsible menu, scroll locking, Escape handling and reduced-motion support. That is a starting point, not evidence that mobile use is successful.

After desktop content and layout are settled, evaluate 320, 375, 390, 430 and 768px widths, landscape orientation and representative real devices. Stack the hero photograph and text into separate blocks without restoring a dark overlay. Check mine comparison cards, filters, account controls, forms and long email addresses for horizontal overflow.

Verify menu open/close, focus movement, hidden-menu keyboard access, return of focus, account submenu access and navigation under zoom. Check that touch controls are comfortably sized and that sticky controls do not hide content or form errors. Test image crops, network loading, text readability, input keyboards, autofill and success/error feedback. Measure page performance and image transfer size after the final assets are selected.

Acceptance: every desktop task can also be completed on mobile; no clipped or inaccessible content; no unintended sideways scrolling; readable content without magnification; operable menu and forms; clear loading, empty and error states. No measured mobile performance or accessibility result is claimed in this planning review.

## Decisions still needed

- Which domain and deployed build should receive changes?
- Which mines are open to investors today, and what is the approved investment structure?
- Should the existing live investor portal be retained, redesigned or replaced by an enquiry-first launch?
- What approved project documents and original photographs are available?
- Who receives enquiries and maintains mine/investment updates?

## Sources

- https://triple7holdings.co.za/
- https://triple7holdings.co.za/investors
- https://triple7holdings.co.za/investors/register
- https://triple7holdings.co.za/investors/login
- https://triple7holdings.co.za/locations
- https://triple7holdings.co.za/locations/bucklands
- https://triple7holdings.co.za/locations/longlands
- https://triple7holdings.co.za/trade
- https://www.triple7holdings.com/
- https://www.triple7holdings.com/tendehouse
- Supplied screenshots and reviewed local source files.
