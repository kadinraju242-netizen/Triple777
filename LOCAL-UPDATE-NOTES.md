# Local replacement update — 8 October 2026

The local folder is the replacement build for .co.za. Nothing has been published.

## Investment recommendation and implemented journey

Launch with project information and enquiries. Bucklands and Longlands are open to investment discussions as confirmed by the owner. Public descriptions use the existing .co.za mine information, with amounts and terms handled by the team rather than invented.

The new page includes opportunity cards, mine detail links, process steps, questions, and a mine-specific email enquiry composer. The composer prepares a message in the visitor's email application and offers a copyable fallback. It does not submit to a server, claim receipt, create accounts or take deposits. An integrated enquiry service is the next improvement when the destination and hosting configuration are settled.

Retain the current live portal until existing investors and their data can be accounted for. Before replacing the live site, confirm whether it is used, arrange access to its records and agree how existing investors will be supported or migrated. The local Trade account system is for buyers/sellers and cannot stand in for investor accounts. A future investor portal should provide approved documents, agreements, funding records and dated project updates once the offering and access controls are defined.

## Shared changes

- Main menu: Home, Trade, Invest, Mines, Mine Projects, About; Account and Contact as utilities.
- Corrected Home and About footprint to 2 mines and 2 locations, removing the Projects statistic.
- Removed Jobs entry points. Former jobs.html now forwards to Contact.
- Removed page breadcrumbs, preserving a contextual All Mines link on mine detail pages.
- Shortened homepage actions to Trade, Our Mines and Invest.
- Lightened shared navy areas and removed decorative label backgrounds.
- Large public-page heroes separate text from unshaded photography.
- Used verified South African regional heritage photography with explicit location captions. The image is the Big Hole in Kimberley, not either Triple 7 mine. Sources are recorded in images/IMAGE-SOURCES.md. The company's existing product and community imagery remains in use. Mine cards use captioned regional imagery rather than unverified operating-mine photos; the original assets remain in the library.
- Removed generic social-network homepage links.
- Improved keyboard focus handling in the mobile menu and adjusted narrow layouts.

## Verification

JavaScript syntax checked. Static local link/image references checked, with none missing. Browser checks performed for Home, Invest, Mines, Bucklands, About and Contact at 320, 390, 768 and 1440px widths. A narrow Bucklands related-mine thumbnail overflow was identified and fixed; retest confirmed no horizontal overflow at 320px. Investor query links select the correct mine; required name/email fields are marked invalid when empty. Mobile menu open/close and Escape focus behaviour checked. No actual emails, accounts or transactions were submitted.

Trade redirects unauthenticated visitors to Sign In in the current build, so responsive visits to trade.html tested the sign-in screen rather than an authenticated catalogue. This remains a usability issue for first-time buyers: consider a publicly browsable catalogue with sign-in required at enquiry. That access policy was not changed as part of this visual/investment update.

Remaining checks before launch: actual investor support/migration, mail delivery (or integrated form service), approved investment documents and terms, authenticated Trade workflow, real-device and performance checks, and the deployment/URL routing for the replacement site.

## Owner revision: full-width imagery

The owner prefers the previous full-width photographic heroes with text over them. Restored that composition on public pages, using the existing .co.za homepage diamond-ring photo on Home. Restored original mine directory cards, mine page hero images and Mine Projects layout/imagery. This supersedes the earlier split-hero and regional mine-card decisions above. The investment content, corrected footprint, navigation, Jobs removal and breadcrumb removal remain. Checked Home, Mines, Mine Projects and Invest at 390px with no horizontal overflow.

## Browser-comment refinements

Rechecked the live .co.za HTML: its first hero uses /brand/operations.jpg; the ring image is a later section. Home now uses the correct operations photograph and has a prominent Invest button. Invest copy moved to a narrow right-hand block, About copy moved below the loader, and the Mines hero enlarged to 560px on desktop. Removed the diamond cutout's navy background/screen blending and the CSI label. Checked these four pages at 1159px and 390px: no horizontal overflow. Full-width image layout retained.
