/* Visual prototype only. Store a demo state, never form answers or files. */
(function () {
  'use strict';
  const key = 't7.investor-preview';
  function state() { try { return sessionStorage.getItem(key); } catch (_) { return null; } }
  function enter(value, target) {
    try { sessionStorage.setItem(key, value); }
    catch (_) { alert('This preview needs browser session storage to navigate between screens.'); return; }
    location.href = target;
  }
  if (document.body.hasAttribute('data-approved-only')) {
    if (state() !== 'approved') { location.replace(state() === 'pending' ? 'investor-pending.html' : 'investor-login.html'); return; }
    document.body.classList.add('preview-approved');
  }
  document.querySelectorAll('[data-preview-approved]').forEach(button => button.addEventListener('click', () => enter('approved', 'investor-dashboard.html')));
  document.querySelectorAll('[data-investor-signout]').forEach(button => button.addEventListener('click', () => { try { sessionStorage.removeItem(key); } catch (_) {} location.href = 'investors.html'; }));
  ['investor-intake', 'investor-login'].forEach(id => {
    const form = document.getElementById(id);
    if (form) {
      form.querySelector('button[type="submit"]').disabled = false;
      form.addEventListener('submit', event => { event.preventDefault(); form.reset(); enter('pending', 'investor-pending.html'); });
    }
  });
  const none = document.querySelector('input[name="investment-type"][value="None"]');
  document.querySelectorAll('input[name="investment-type"]').forEach(input => input.addEventListener('change', () => {
    if (input === none && input.checked) document.querySelectorAll('input[name="investment-type"]').forEach(other => { if (other !== none) other.checked = false; });
    else if (input.checked && none) none.checked = false;
  }));
  const filter = document.getElementById('project-filter');
  if (filter) filter.addEventListener('change', () => document.querySelectorAll('[data-project]').forEach(card => { card.hidden = filter.value !== 'all' && filter.value !== card.dataset.project; }));
  const panel = document.getElementById('discussion');
  let interestedProject = '';
  document.querySelectorAll('[data-discuss]').forEach(button => button.addEventListener('click', () => {
    interestedProject = button.dataset.discuss;
    document.getElementById('discussion-title').textContent = 'Register interest in ' + interestedProject;
    document.getElementById('interest-feedback').hidden = true;
    document.getElementById('interest-confirm').disabled = false;
    panel.hidden = false; panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('discussion-title').setAttribute('tabindex', '-1'); document.getElementById('discussion-title').focus({ preventScroll: true });
  }));
  const close = document.getElementById('discussion-close');
  if (close) close.addEventListener('click', () => { panel.hidden = true; document.querySelector('[data-discuss]').focus(); });
  const confirm = document.getElementById('interest-confirm');
  if (confirm) confirm.addEventListener('click', () => {
    const message = document.getElementById('interest-feedback');
    message.textContent = 'Interest registered for ' + interestedProject + '. Your investor relations team will contact you to arrange a project discussion. Demo confirmation — no request has been sent.';
    message.hidden = false; confirm.disabled = true;
  });
  const documents = {
    bucklands: { title: 'Bucklands · Project brief', content: '<p class="document-meta">T7-NC-001 · Updated 02 October 2026</p><h3>Project overview</h3><p>A diamond mining project in the Douglas area of the Northern Cape. The current funding phase supports preparation and mobilisation.</p><h3>Funding allocation</h3><dl class="portal-dl"><div><dt>Funding target</dt><dd>R8,000,000</dd></div><div><dt>Capital allocated</dt><dd>R4,800,000 · 60%</dd></div><div><dt>Indicative participation</dt><dd>From R250,000</dd></div></dl><h3>Planned use of capital</h3><ul><li>45% equipment mobilisation</li><li>30% site preparation</li><li>25% commissioning and contingency</li></ul><h3>Next milestone</h3><p>Equipment mobilisation and site commissioning review. Monthly progress reporting will cover readiness, spend and the next operational actions.</p><h3>Review considerations</h3><p>Equipment readiness, permitting, recovery variability, operating costs and the proposed participation agreement require review before a commitment.</p>' },
    longlands: { title: 'Longlands · Operations update', content: '<p class="document-meta">T7-NC-002 · September 2026 · Issued 05 October 2026</p><h3>September at a glance</h3><p>The site team reviewed plant readiness, maintenance priorities and the working-capital schedule for the next operating cycle.</p><dl class="portal-dl"><div><dt>Funding target</dt><dd>R6,000,000</dd></div><div><dt>Capital allocated</dt><dd>R4,200,000 · 70%</dd></div><div><dt>Indicative participation</dt><dd>From R100,000</dd></div></dl><h3>Operating priorities</h3><ul><li>Operating capital allocation: 50%</li><li>Plant maintenance allocation: 30%</li><li>Recovery and logistics allocation: 20%</li></ul><h3>Next reporting cycle</h3><p>The October update will cover maintenance completion, operating readiness and recovery programme progress.</p><h3>Review considerations</h3><p>Production variability, plant downtime, commodity pricing and operating costs remain relevant to the project assessment.</p>' },
    statement: { title: 'Investment statement · September 2026', content: '<p class="document-meta">Thabo Molefe · T7-INV-0248 · Statement date 30 September 2026</p><h3>Committed capital</h3><dl class="portal-dl"><div><dt>Bucklands · 12 Aug 2026</dt><dd>R750,000</dd></div><div><dt>Longlands · 02 Sep 2026</dt><dd>R500,000</dd></div><div><dt>Total committed</dt><dd><strong>R1,250,000</strong></dd></div><div><dt>Distributions this period</dt><dd>R0.00</dd></div></dl><h3>Portfolio notes</h3><p>Two active project allocations. The next portfolio review is scheduled for 30 October 2026. Committed capital is an allocation record, not a current valuation or a guaranteed return.</p>' },
    verification: { title: 'Investor verification summary', content: '<p class="document-meta">T7-INV-0248 · Approved 18 September 2026</p><h3>Investor profile</h3><dl class="portal-dl"><div><dt>Name</dt><dd>Thabo Molefe</dd></div><div><dt>Country</dt><dd>South Africa</dd></div><div><dt>Company</dt><dd>Molefe Capital (demo)</dd></div><div><dt>Capacity</dt><dd>R500,000 – R5M</dd></div><div><dt>Experience</dt><dd>Mining, Property, Business</dd></div><div><dt>Risk preference</dt><dd>Medium risk / Medium return</dd></div><div><dt>Investment readiness</dt><dd>1 week</dd></div></dl><h3>Verification record</h3><ul><li>Identity document reviewed</li><li>Proof of funds reviewed</li><li>Company registration reviewed</li><li>Opportunity access enabled</li></ul><p>This sample summary contains no identity numbers or bank details.</p>' }
  };
  const dialog = document.getElementById('document-dialog');
  let documentTrigger;
  document.querySelectorAll('[data-document]').forEach(button => button.addEventListener('click', () => {
    const record = documents[button.dataset.document];
    if (!record || !dialog) return;
    documentTrigger = button;
    document.getElementById('document-title').textContent = record.title;
    document.getElementById('document-content').innerHTML = record.content;
    dialog.showModal();
  }));
  if (dialog) {
    document.getElementById('document-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (documentTrigger) documentTrigger.focus(); });
  }
  document.querySelectorAll('.portal-tabs a').forEach(link => { if (link.getAttribute('href') === location.pathname.split('/').pop()) link.setAttribute('aria-current', 'page'); });
})();
