/* ============================================================
   Triple 7 Holdings — investor approvals (admin)
   ------------------------------------------------------------
   Lets an admin approve or reject investor registrations from the
   site instead of the Supabase SQL Editor.

   It uses what already exists and adds nothing to the database:
     · T7.auth.require(['admin'])  the same gate investor-review.js uses
     · T7.client()                 the same Trade-side Supabase client
     · investor_application_read   admins already read every row
     · investor_application_admin_update   admins already update them
     · status                      already constrained to
                                   pending / approved / rejected / suspended

   The gate below only decides which screen somebody sees. What
   actually stops a non-admin writing is the row-level policy on the
   table, which is why every write is read back and counted: if the
   policy refuses, PostgREST returns success with zero rows, and a
   silent no-op must not be reported as a save.
   ============================================================ */
(async () => {
  const root = document.getElementById('approvals-root');
  const feedbackEl = document.getElementById('approval-feedback');
  if (!root) return;

  const STATUSES = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };

  /* The questions the intake form stores in application jsonb. Only the
     ones actually present on a record are shown — a missing answer is
     left out rather than printed as a dash, which would read as "none"
     when the truth is "not asked". */
  const ANSWERS = [
    ['capacity',        'Investment capacity'],
    ['funds',           'Source of funds'],
    ['verification',    'Verification'],
    ['experience',      'Experience'],
    ['investment_types', 'Investment types'],
    ['risk',            'Risk appetite'],
    ['timing',          'Timing'],
    ['signature',       'Signed by'],
    ['signature-date',  'Signed on']
  ];

  function el(parent, tag, text, cls) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null && text !== '') node.textContent = text;
    if (cls) node.className = cls;
    if (parent) parent.append(node);
    return node;
  }

  function say(text, isError) {
    feedbackEl.textContent = text;
    feedbackEl.className = 'approval-feedback' + (isError ? ' is-error' : ' is-ok');
    feedbackEl.hidden = false;
  }

  /* ---------- confirmation ----------
     A native <dialog>, so Esc, the focus trap and the backdrop come from
     the browser rather than being re-implemented. It is built once and
     reused; the animation lives in the stylesheet and is dropped under
     prefers-reduced-motion. */
  let sheet;
  function confirmSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('dialog');
    sheet.className = 'approval-confirm';

    const form = el(sheet, 'form');
    form.method = 'dialog';                 // a button press closes it and sets returnValue

    sheet.heading = el(form, 'h2', '', 'approval-confirm-title');
    sheet.who     = el(form, 'p', '', 'approval-confirm-who');
    sheet.note    = el(form, 'p', '', 'approval-confirm-note');

    const row = el(form, 'div', '', 'approval-confirm-actions');
    sheet.cancel = el(row, 'button', 'Cancel', 'btn btn-outline');
    sheet.cancel.value = 'cancel';
    sheet.go = el(row, 'button', 'Confirm', 'btn btn-solid');
    sheet.go.value = 'confirm';

    /* Clicking the dark area outside the card dismisses it. */
    sheet.addEventListener('click', event => {
      if (event.target === sheet) { sheet.returnValue = 'cancel'; sheet.close(); }
    });

    document.body.append(sheet);
    return sheet;
  }

  function ask(title, who, note, confirmLabel) {
    const s = confirmSheet();
    s.heading.textContent = title;
    s.who.textContent = who;
    s.note.textContent = note;
    s.go.textContent = confirmLabel;
    s.returnValue = 'cancel';
    s.showModal();
    s.cancel.focus();                       // never land on the action by default
    return new Promise(resolve => {
      s.addEventListener('close', () => resolve(s.returnValue === 'confirm'), { once: true });
    });
  }

  function day(value) {
    if (!value) return '';
    const d = new Date(value);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function definitions(parent, rows) {
    const dl = el(parent, 'dl', '', 'portal-dl');
    let printed = 0;
    for (const [term, value] of rows) {
      if (value === null || value === undefined || value === '') continue;
      const row = el(dl, 'div');
      el(row, 'dt', term);
      el(row, 'dd', value);
      printed++;
    }
    if (!printed) dl.remove();
    return printed;
  }

  let client;
  let records = [];

  /* ---------- one record ---------- */
  function card(record) {
    const panel = el(null, 'article', '', 'portal-panel approval-card');
    panel.dataset.user = record.user_id;

    const head = el(panel, 'div', '', 'approval-head');
    const titles = el(head, 'div');
    el(titles, 'h2', record.full_name || record.email);
    el(titles, 'p', record.email, 'approval-email');
    const pill = el(head, 'span', STATUSES[record.status] || record.status,
                    'status-pill ' + record.status);

    definitions(panel, [
      ['Company',   record.company],
      ['Country',   record.country],
      ['Phone',     record.phone],
      ['Submitted', day(record.created_at)],
      ['Reviewed',  day(record.reviewed_at)]
    ]);

    /* ---- review detail, revealed in place ---- */
    const detailId = 'detail-' + record.user_id;
    const detail = el(panel, 'div', '', 'approval-detail');
    detail.id = detailId;
    detail.hidden = true;

    const answers = record.application || {};
    const rows = ANSWERS
      .map(([key, label]) => [label, Array.isArray(answers[key]) ? answers[key].join(', ') : answers[key]])
      .filter(([, value]) => value !== undefined && value !== null && value !== '');
    el(detail, 'h3', 'Registration answers');
    if (!definitions(detail, rows)) {
      el(detail, 'p', 'This registration has no stored answers. Accounts enrolled directly in SQL have none.', 'field-help');
    }

    const actions = el(panel, 'div', '', 'portal-actions');

    const reviewBtn = el(actions, 'button', 'Review', 'btn btn-outline');
    reviewBtn.type = 'button';
    reviewBtn.setAttribute('aria-expanded', 'false');
    reviewBtn.setAttribute('aria-controls', detailId);
    reviewBtn.addEventListener('click', () => {
      const open = detail.hidden;
      detail.hidden = !open;
      reviewBtn.setAttribute('aria-expanded', String(open));
      reviewBtn.textContent = open ? 'Hide details' : 'Review';
    });

    /* An already-approved record only offers Reject, and the reverse, so
       the button on screen always changes something. */
    const offer = [];
    if (record.status !== 'approved') offer.push(['approved', 'Approve', 'btn btn-solid']);
    if (record.status !== 'rejected') offer.push(['rejected', 'Reject',  'btn btn-outline']);

    for (const [next, label, cls] of offer) {
      const button = el(actions, 'button', label, cls);
      button.type = 'button';
      button.addEventListener('click', () => decide(record, next, panel, actions));
    }

    return panel;
  }

  /* ---------- the write ---------- */
  async function decide(record, next, panel, actions) {
    const who = record.full_name || record.email;
    const approving = next === 'approved';

    const agreed = await ask(
      approving ? 'Approve this registration?' : 'Reject this registration?',
      who + ' · ' + record.email,
      approving
        ? 'They will be able to sign in and see published project opportunities.'
        : 'They keep their account but will not reach the investor workspace. You can approve them later.',
      approving ? 'Approve' : 'Reject'
    );
    if (!agreed) return;

    const buttons = actions.querySelectorAll('button');
    buttons.forEach(b => { b.disabled = true; });
    say('Saving…');

    try {
      const result = await client
        .from('investor_applications')
        .update({ status: next, reviewed_at: new Date().toISOString() })
        .eq('user_id', record.user_id)
        .select('user_id,status,reviewed_at');

      if (result.error) throw result.error;
      /* Zero rows means the policy refused the write. Reporting that as
         saved would be the one thing worse than failing. */
      if (!result.data || result.data.length !== 1) {
        throw new Error('Nothing was saved. Confirm you are signed in as an admin.');
      }

      Object.assign(record, result.data[0]);
      say(who + ' ' + (next === 'approved' ? 'approved' : 'rejected') + '.');
      paint();
      const moved = document.querySelector('[data-user="' + record.user_id + '"]');
      if (moved) moved.scrollIntoView({ block: 'center' });
    } catch (error) {
      buttons.forEach(b => { b.disabled = false; });
      say(error.message || 'The change could not be saved. Please try again.', true);
    }
  }

  /* ---------- render ---------- */
  function section(parent, title, blurb, list, emptyText) {
    const wrap = el(parent, 'section', '', 'approval-group');
    const header = el(wrap, 'div', '', 'approval-group-head');
    el(header, 'h2', title + ' (' + list.length + ')');
    if (blurb) el(header, 'p', blurb, 'field-help');
    if (!list.length) {
      el(wrap, 'p', emptyText, 'approval-empty');
      return;
    }
    for (const record of list) wrap.append(card(record));
  }

  function paint() {
    root.replaceChildren();
    const pending  = records.filter(r => r.status === 'pending');
    const reviewed = records.filter(r => r.status !== 'pending');

    section(root, 'Pending approvals',
      'Registrations waiting for a decision.',
      pending,
      'No pending approvals. Every registration has been reviewed.');

    section(root, 'Reviewed',
      'Everyone else, with the decision currently on their account.',
      reviewed,
      'Nothing has been reviewed yet.');
  }

  /* ---------- load ---------- */
  try {
    const profile = await T7.auth.require(['admin']);
    if (!profile) return;                    // require() has already redirected

    client = await T7.client();
    root.replaceChildren();
    el(root, 'p', 'Loading registrations…', 'auth-wait');

    const result = await client
      .from('investor_applications')
      .select('user_id,full_name,email,phone,country,company,application,status,created_at,reviewed_at')
      .order('created_at', { ascending: false });

    if (result.error) throw result.error;
    records = result.data || [];
    paint();
  } catch (error) {
    root.replaceChildren();
    el(root, 'p', 'The registrations could not be loaded: ' +
      (error && error.message ? error.message : 'unknown error') +
      ' Confirm the investor migration is installed and that you are signed in as an admin.',
      'approval-error');
  }
})();
