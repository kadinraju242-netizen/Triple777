from pathlib import Path
import re
investor_files=['investors.html','investor-login.html','investor-register.html','investor-pending.html','investor-dashboard.html','project-opportunities.html']
for name in investor_files:
 p=Path(name);s=p.read_text(encoding='utf8')
 s=s.replace('<a href="signin.html?mode=signup" data-nav-register>Register</a><a href="signin.html" data-nav-signin>Sign In</a>','<a href="investor-register.html">Investor Register</a><a href="investor-login.html">Investor Login</a>')
 s=re.sub(r'<div class="demo-label">.*?</div>','',s,flags=re.S)
 s=re.sub(r'<button[^>]*data-preview-approved[^>]*>.*?</button>','',s,flags=re.S)
 s=s.replace('visual prototype.','portal.').replace('Enable JavaScript to preview this form. Nothing is submitted without it.','Enable JavaScript to use investor registration and sign-in.')
 s=re.sub(r'<script src="js/investor-portal.js[^\"]*"></script>','<script src="js/config.js"></script><script src="js/vendor/supabase.js"></script><script src="js/investor-live.js?v=20261010"></script>',s)
 if name=='investor-login.html':
  s=s.replace('Demo mode · Sign in opens the application-review screen.','Investor sign-in is separate from Trade sign-in.')
  s=re.sub(r'<aside class="portal-panel">.*?</aside>','<aside class="portal-panel"><p class="eyebrow">Investor access</p><h2>Your dedicated investor account.</h2><p>Sign in to check your application status. Approved investors can access published project opportunities.</p><a href="signin.html">Looking for Trade Login?</a></aside>',s,flags=re.S)
 if name=='investor-register.html':
  s=s.replace('Complete all five sections. Company information and proof-of-funds documents are optional where indicated.','Complete your application and create your investor login. Company information is optional.')
  s=s.replace('<li>Uploads</li>','<li>Create your login</li>')
  s=re.sub(r'<fieldset><legend><span>E</span> Uploads</legend>.*?</fieldset>','<fieldset><legend><span>E</span> Create your investor login</legend><div class="form-grid"><div><label for="password">Password</label><input id="password" name="password" type="password" required minlength="8" autocomplete="new-password"></div><div><label for="password-confirm">Confirm password</label><input id="password-confirm" name="password-confirm" type="password" required minlength="8" autocomplete="new-password"></div></div><p class="field-help">After email confirmation, use Investor Login. The team will arrange supporting documents separately; file uploads are not connected yet.</p></fieldset>',s,flags=re.S)
 if name in ['investor-pending.html','investor-dashboard.html','project-opportunities.html']:
  s=s.replace('<body class="page-investors investor-portal"','<body data-investor-protected class="page-investors investor-portal"')
  s=re.sub(r'<main[^>]*>.*?</main>','<main id="main-content"><section class="portal-section"><div class="wrap"><p role="status">Loading your investor account…</p><noscript>Enable JavaScript to access the investor portal.</noscript></div></section></main>',s,flags=re.S)
 p.write_text(s,encoding='utf8')
# On investor pages the account menu must not substitute Trade routes.
p=Path('js/account-menu.js');s=p.read_text(encoding='utf8');s=s.replace('function paint() {','function paint() {\n    if (document.body.classList.contains("investor-portal")) return;',1);p.write_text(s,encoding='utf8')
