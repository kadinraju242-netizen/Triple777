-- SAMPLE DATA for the REAL investor dashboard, not a mock browser mode.
-- Prerequisite: 11_investor_workspace.sql has been applied.
-- Applies to every account already registered in investor_applications.
-- Approval status stays unchanged; dashboard access still requires approval.
-- Run again to populate investors who register later.
-- Creates separate SAMPLE projects and investments; does not alter genuine projects,
-- account approval, profile preferences, or existing investment records.
-- Does not create enquiries, so no investor notification emails are queued.
-- Re-running for the same account does not duplicate these records.
begin;
do $sample$
declare
  investor_id uuid;
  investor_count integer := 0;
  sample_bucklands constant uuid := '77700000-1018-4000-8000-000000000001';
  sample_longlands constant uuid := '77700000-1018-4000-8000-000000000002';
  sample_exploration constant uuid := '77700000-1018-4000-8000-000000000003';
begin
  insert into public.investor_projects
    (id,name,description,location,published,country,region,commodity,stage,minimum_investment_zar,eligible_countries)
  values
    (sample_bucklands,'SAMPLE — Bucklands investment',
     'Fictional sample project for testing the investor dashboard. Not an actual investment offer. All amounts, stages and progress reports are made up.',
     'Douglas, Northern Cape',true,'South Africa','Northern Cape','Diamonds','Sample development stage',250000,'{}'),
    (sample_longlands,'SAMPLE — Longlands investment',
     'Fictional sample project demonstrating investment tracking and project updates. Not an actual investment offer.',
     'Northern Cape, South Africa',true,'South Africa','Northern Cape','Diamonds','Sample operating stage',100000,'{}'),
    (sample_exploration,'SAMPLE — Regional exploration opportunity',
     'Entirely fictional exploration opportunity to demonstrate budget and location matching. No real project or investment offer is represented.',
     'Central District, Botswana',true,'Botswana','Central District','Gold','Sample exploration stage',1500000,'{}')
  on conflict (id) do nothing;

  for investor_id in select user_id from public.investor_applications loop
  insert into public.investor_holdings
    (id,user_id,project_id,amount,currency,invested_on,status,reference)
  values
    (md5(investor_id::text || ':sample-workspace-bucklands-20261018')::uuid,
     investor_id,sample_bucklands,350000,'ZAR','2026-09-01','active','SAMPLE ONLY — no funds received — SW-20261018-01'),
    (md5(investor_id::text || ':sample-workspace-longlands-20261018')::uuid,
     investor_id,sample_longlands,150000,'ZAR','2026-09-20','active','SAMPLE ONLY — no funds received — SW-20261018-02')
  on conflict (id) do nothing;

  investor_count := investor_count + 1;
  end loop;

  insert into public.investor_project_updates
    (id,project_id,title,body,milestone,progress_percent,published,report_date)
  values
    ('77700000-1018-4000-9000-000000000001',sample_bucklands,
     'SAMPLE — Project mobilisation started',
     'Fictional update: access planning and equipment scheduling have begun. This report is for dashboard testing only.',
     'SAMPLE — Finish site preparation',20,true,'2026-09-15'),
    ('77700000-1018-4000-9000-000000000002',sample_bucklands,
     'SAMPLE — Site preparation completed',
     'Fictional update: site preparation is complete and equipment mobilisation is the next step. The 40% figure is made up and is not a financial return.',
     'SAMPLE — Equipment mobilisation',40,true,'2026-10-15'),
    ('77700000-1018-4000-9000-000000000003',sample_longlands,
     'SAMPLE — Maintenance and readiness review',
     'Fictional update: plant checks are progressing ahead of the next operating cycle. The 65% figure is made up and is not a financial return.',
     'SAMPLE — Complete plant checks',65,true,'2026-10-16')
  on conflict (id) do nothing;

  raise notice 'Sample data is ready for % registered investor accounts. Each has two SAMPLE investments totalling R500,000. Approval status was not changed. Approved investors can refresh their dashboards.', investor_count;
end;
$sample$;
commit;
