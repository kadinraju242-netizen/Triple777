/* ============================================================
   Triple 7 Holdings — frontend configuration
   ------------------------------------------------------------
   Paste your Supabase project's two public values here and the
   Trade Desk comes alive: sign-in, lots, enquiries, dashboards.
   Find them in Supabase under Project Settings -> API.

   Both values are PUBLIC by design. The anon key is meant to be
   shipped to browsers; it is safe because every table has
   row-level security (supabase/01_schema.sql), so on its own
   the key can read nothing at all: every lot, account and enquiry
   needs a signed-in member.

   The service-role key must NEVER appear in this file or anywhere
   in this folder. The site does not need it.

   While these are empty the rest of the site still works, and the
   sign-in page says the database is not connected yet.
   ============================================================ */
window.T7_CONFIG = {
  supabaseUrl: 'https://zqbqgtdpnhgyhuplnzhs.supabase.co',      // e.g. 'https://xxxxxxxx.supabase.co'
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpxYnFndGRwbmhneWh1cGxuemhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0MTE4MDUsImV4cCI6MjEwNjk4NzgwNX0.z-8ym7ISCG8zu9gEC79yO_5wEfVzYzbhzGPegotoPOM'   // the anon / publishable key
};
