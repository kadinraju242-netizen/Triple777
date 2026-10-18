# Investor workspace database activation

Apply `supabase/11_investor_workspace.sql` in the connected Supabase project's SQL Editor after migrations 04 and 07–10. The migration is additive and rerunnable. It does not create sample investments, amounts, project criteria or progress reports.

The local frontend has been wired to the new tables; this SQL has not been applied remotely by Codex. Until it is applied, existing approvals/projects/enquiries remain usable, and the dashboard explicitly reports investment tracking as awaiting setup. Profile preference editing also needs the migration.

After applying it:

1. Sign in as an admin and open `investor-review.html`. Expand **Project matching settings** to enter each project's country, region, commodity, stage, minimum participation and any eligible residence countries. A blank eligible-country list means no residence restriction for matching. Missing project criteria produce **Details pending**, not a false match.
2. Use **Record confirmed investment** only for verified participation. Select the investor/project, amount, currency, date and agreement/payment reference. The investor sees only their own investment records.
3. Use **Publish project progress update** to record a dated update, optional next milestone and optional reported percentage. Drafts are admin-only. Published reports are visible to approved investors with holdings in that project. A progress percentage is entered by the team, not calculated from funding or enquiries.
4. Investors can edit their residence, available budget and preferred project countries/regions. Registration starts at R100,000. Matching uses exact budget where provided, otherwise conservatively handles older capacity bands. A capacity band straddling the minimum produces a potential match.
5. Confirm with two approved investor accounts that each sees only their own holdings and that a project holder can read its overview after publication is turned off. Check drafts remain invisible. SQL policies implement these rules; live policy verification still requires the migration to be applied.

Residence and preferred locations contribute separately to ranking; matching either can surface a project, and matching both ranks it higher. Explicit eligible residence lists take precedence. Matching is discovery guidance, not investment approval or payment processing. No automatic currency conversion is used: project thresholds and available budgets are in ZAR, while recorded holdings retain ZAR or USD.

Validation completed locally: matching unit tests and existing notification tests; isolated browser fixtures for project details, published progress display, profile preference callbacks, project filters, form minimums and mobile overflow. No live investment records were created during testing.
