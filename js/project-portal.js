/* ============================================================
   Mine projects — project-portal.html
   Signed out: sign in (any Triple 7 login) or create a project account.
   Owner:      their projects, each waiting for approval or decided.
   Admin:      the review queue for every submitted project.
   ============================================================ */
(async function () {
  'use strict';
  const root = document.getElementById('project-portal-root');
  const P = window.T7Projects;
  const el = T7P.el;
  const RECOVERY = /type=recovery/.test(location.hash);

  function show(nodes) { root.replaceChildren(...[].concat(nodes).filter(Boolean)); }
  function feedback(form) {
    let f = form.querySelector('.form-feedback');
    if (!f) { f = el('p', { class: 'form-feedback', role: 'status' }); form.append(f); }
    return { set(text, bad) { f.textContent = text; f.classList.toggle('is-error', Boolean(bad)); } };
  }
  function field(label, attrs, help) {
    const id = 'a-' + (attrs.id || attrs.name);
    const input = el('input', Object.assign({ id: id }, attrs));
    const wrap = el('div', { class: 'pp-field' }, [el('label', { for: id, text: label }), input, help ? el('p', { class: 'pp-help', text: help }) : null]);
    if (attrs.type === 'password') {
      const toggle = el('button', { type: 'button', class: 'pp-show', text: 'Show', 'aria-label': 'Show password' });
      toggle.addEventListener('click', () => { const on = input.type === 'password'; input.type = on ? 'text' : 'password'; toggle.textContent = on ? 'Hide' : 'Show'; });
      wrap.classList.add('has-toggle'); wrap.append(toggle);
    }
    return wrap;
  }
  const ownerPill = s => el('span', { class: 'pp-pill s-' + s, text: P.label('owner_status', s) });
  const adminPill = s => el('span', { class: 'pp-pill s-' + s, text: P.label('status', s) });
  async function run(form, button, fb, work) {
    if (!form.reportValidity()) return;
    button.disabled = true; fb.set('Please wait…');
    try { await work(); }
    catch (e) { fb.set(T7P.friendly(e), true); }
    finally { button.disabled = false; }
  }
  const commodityOf = r => r.commodity === 'other' ? (r.commodity_other || 'Other') : P.label('commodity', r.commodity);

  if (!T7P.configured) {
    show(el('div', { class: 'pp-card pp-narrow' }, [el('h2', { text: 'Not connected yet' }), el('p', { text: 'Project sign-in is not configured on this copy of the site. Please contact the team.' })]));
    return;
  }

  const client = await T7P.client();
  let recovering = RECOVERY;
  client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') { recovering = true; renderRecovery(); } });

  /* ---------------- Signed out ---------------- */
  function renderSignedOut(tab, notice) {
    tab = tab || 'signin';
    T7P.hero({ eyebrow: 'Triple 7 Mining Division', title: 'Project Portal', em: 'Bring your ground forward.', sub: 'Submit a mine project to the Mining Division, save it as you go and follow it through to a decision.', image: 'images/mines/mine-projects.jpg' });

    const seg = el('div', { class: 'pp-seg', role: 'tablist', 'aria-label': 'Sign in or create an account' });
    const body = el('div', { class: 'pp-auth-body' });
    const card = el('div', { class: 'pp-auth-card' }, [seg, body]);

    function segButton(key, text) {
      return el('button', { type: 'button', role: 'tab', 'aria-selected': tab === key ? 'true' : 'false', class: tab === key ? 'is-active' : '', text: text,
        onclick: () => { tab = key; paint(); } });
    }

    function signInForm() {
      const form = el('form', { class: 'pp-form' }, [
        el('p', { class: 'pp-form-lede', text: 'Welcome back. Use the email and password of any Triple 7 account.' }),
        field('Email', { name: 'email', type: 'email', required: true, autocomplete: 'email' }),
        field('Password', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })
      ]);
      const button = el('button', { class: 'btn btn-solid pp-wide', type: 'submit', text: 'Sign In' });
      form.append(button, el('div', { class: 'pp-form-foot' }, [
        el('button', { type: 'button', class: 'pp-link', text: 'Forgot your password?', onclick: () => { tab = 'forgot'; paint(); } }),
        el('span', {}, ['New here? ', el('button', { type: 'button', class: 'pp-link', text: 'Create an account', onclick: () => { tab = 'signup'; paint(); } })])
      ]));
      const fb = feedback(form);
      if (notice) fb.set(notice);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const d = new FormData(form);
        run(form, button, fb, async () => { await T7P.signIn(d.get('email').trim(), d.get('password')); await route(); });
      });
      return form;
    }

    function signUpForm() {
      const form = el('form', { class: 'pp-form' }, [
        el('p', { class: 'pp-form-lede', text: 'Your account needs only your name, an email and a password. Project details come next.' }),
        el('div', { class: 'pp-grid' }, [
          field('First name', { name: 'first_name', required: true, autocomplete: 'given-name', maxlength: 80 }),
          field('Surname', { name: 'last_name', required: true, autocomplete: 'family-name', maxlength: 80 })
        ]),
        field('Email', { name: 'email', type: 'email', required: true, autocomplete: 'email' }),
        field('Password', { name: 'password', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }, 'At least 8 characters.'),
        field('Confirm password', { name: 'confirm', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })
      ]);
      const button = el('button', { class: 'btn btn-solid pp-wide', type: 'submit', text: 'Create Account' });
      form.append(button, el('div', { class: 'pp-form-foot' }, [
        el('span', {}, ['Already have a Triple 7 login? ', el('button', { type: 'button', class: 'pp-link', text: 'Sign in', onclick: () => { tab = 'signin'; paint(); } })])
      ]));
      const fb = feedback(form);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const d = new FormData(form);
        run(form, button, fb, async () => {
          if (d.get('password') !== d.get('confirm')) throw new Error('The two passwords do not match.');
          const result = await T7P.signUp({ first_name: d.get('first_name').trim(), last_name: d.get('last_name').trim(), email: d.get('email').trim(), password: d.get('password') });
          if (result === 'exists') { fb.set('That email already has a Triple 7 account (Trade or Investor). Sign in with it instead — the same login works here.', true); return; }
          if (result === 'signed-in') { await route(); return; }
          form.reset();
          fb.set('Almost done. We sent a confirmation link to ' + d.get('email').trim() + '. Open it, then sign in here.');
        });
      });
      return form;
    }

    function forgotForm() {
      const form = el('form', { class: 'pp-form' }, [
        el('h2', { class: 'pp-form-title', text: 'Reset your password' }),
        el('p', { class: 'pp-form-lede', text: 'Enter the email you sign in with and we will send you a link to choose a new password.' }),
        field('Email', { name: 'email', type: 'email', required: true, autocomplete: 'email' })
      ]);
      const button = el('button', { class: 'btn btn-solid pp-wide', type: 'submit', text: 'Send Reset Link' });
      form.append(button, el('div', { class: 'pp-form-foot' }, [el('button', { type: 'button', class: 'pp-link', text: '← Back to sign in', onclick: () => { tab = 'signin'; paint(); } })]));
      const fb = feedback(form);
      form.addEventListener('submit', e => {
        e.preventDefault();
        const email = new FormData(form).get('email').trim();
        run(form, button, fb, async () => { await T7P.resetPassword(email); fb.set('If ' + email + ' has an account, a reset link is on its way.'); });
      });
      return form;
    }

    function paint() {
      seg.replaceChildren(segButton('signin', 'Sign In'), segButton('signup', 'Create Account'));
      seg.hidden = tab === 'forgot';
      body.replaceChildren(tab === 'signup' ? signUpForm() : tab === 'forgot' ? forgotForm() : signInForm());
    }
    paint();

    const copy = el('div', { class: 'pp-auth-copy' }, [
      el('p', { class: 'eyebrow', text: 'One login for Triple 7' }),
      el('h2', { class: 'section-title' }, ['Already with us?', el('br'), el('em', { text: 'Sign in as you are.' })]),
      el('p', { class: 'pp-lede', text: 'Your Trade or Investor login works here too. New to Triple 7? Create a project account in under a minute.' }),
      el('dl', { class: 'pp-points' }, [
        ['Trade', 'Buyers and sellers sign in with the same email and password.'],
        ['Invest', 'Investor accounts work here without a second registration.'],
        ['New', 'Just your name, surname, email and a password.']
      ].map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })])))
    ]);

    const steps = el('section', { class: 'pp-band' }, [el('div', { class: 'pp-band-inner' }, [
      el('div', { class: 'pp-band-head' }, [el('p', { class: 'eyebrow', text: 'How it works' }), el('h2', { class: 'section-title' }, ['From first draft', el('br'), el('em', { text: 'to a decision.' })])]),
      el('ol', { class: 'pp-steps' }, [
        ['01', 'Create your account', 'Or sign in with the Triple 7 login you already have.'],
        ['02', 'Build your profile', 'Location, rights, technical status, capital and documents. Save as you go.'],
        ['03', 'Submit for approval', 'The Mining Division reviews every detail you send.'],
        ['04', 'Hear back', 'You see the decision and the team’s message right here.']
      ].map(([n, h, p]) => el('li', {}, [el('span', { text: n }), el('h3', { text: h }), el('p', { text: p })])))
    ])]);

    show([el('div', { class: 'pp-auth-layout' }, [copy, card]), steps]);
  }

  /* ---------------- Password recovery ---------------- */
  function renderRecovery() {
    T7P.hero({ eyebrow: 'Triple 7 Mining Division', title: 'New password.', em: 'Then straight back in.', sub: '' });
    const form = el('form', { class: 'pp-form' }, [
      el('h2', { class: 'pp-form-title', text: 'Choose a new password' }),
      field('New password', { name: 'password', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' }, 'At least 8 characters.'),
      field('Confirm new password', { name: 'confirm', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })
    ]);
    const button = el('button', { class: 'btn btn-solid pp-wide', type: 'submit', text: 'Save Password' });
    form.append(button);
    const fb = feedback(form);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const d = new FormData(form);
      run(form, button, fb, async () => {
        if (d.get('password') !== d.get('confirm')) throw new Error('The two passwords do not match.');
        await T7P.setPassword(d.get('password'));
        recovering = false;
        history.replaceState(null, '', location.pathname);
        await route();
      });
    });
    show(el('div', { class: 'pp-auth-card pp-narrow' }, [form]));
  }

  /* ---------------- Owner ---------------- */
  async function renderOwner(profile) {
    const rows = T7P.unwrap(await client.from('mine_projects')
      .select('id,name,commodity,commodity_other,province,country,status,review_note,updated_at,submitted_at,capital_band')
      .eq('owner_id', profile.id).order('updated_at', { ascending: false }));

    const first = profile.first_name || T7P.name(profile).split(' ')[0];
    const waiting = rows.filter(r => r.status === 'submitted' || r.status === 'under_review').length;
    T7P.hero({
      eyebrow: 'Project Portal', title: 'Welcome, ' + first + '.',
      em: rows.length ? 'Your projects, in one place.' : 'Let’s start your first project.',
      sub: rows.length ? (waiting ? waiting + (waiting === 1 ? ' project is' : ' projects are') + ' awaiting approval from the Mining Division.' : 'Pick up a draft, or start something new.') : 'Build your project profile at your own pace. Your draft saves as you go.',
      image: rows[0] ? P.image(rows[0].commodity) : 'images/mines/mine-projects.jpg'
    });

    const bar = el('div', { class: 'pp-toolbar' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Signed in as ' + profile.email }), el('h2', { class: 'pp-h2', text: 'Your projects' })]),
      el('div', { class: 'pp-toolbar-actions' }, [
        el('a', { class: 'btn btn-solid', href: 'project-profile.html', text: 'Start a New Project' }),
        el('button', { type: 'button', class: 'btn btn-ghost-dark', text: 'Sign Out', onclick: signOut })
      ])
    ]);

    const grid = el('div', { class: 'pp-project-grid' });
    for (const r of rows) {
      const editable = r.status === 'draft' || r.status === 'changes_requested';
      const actions = el('div', { class: 'pp-tile-actions' }, [
        el('a', { class: 'btn ' + (editable ? 'btn-solid' : 'btn-ghost-dark'), href: 'project-profile.html?id=' + r.id,
          text: r.status === 'draft' ? 'Continue Editing' : r.status === 'changes_requested' ? 'Make Changes' : 'View Submission' })
      ]);
      if (r.status === 'draft') {
        actions.append(el('button', { type: 'button', class: 'pp-link pp-danger', text: 'Delete draft', onclick: async ev => {
          if (!confirm('Delete this draft? This cannot be undone.')) return;
          ev.target.disabled = true;
          try { T7P.unwrap(await client.from('mine_projects').delete().eq('id', r.id)); await route(); }
          catch (e) { alert(T7P.friendly(e)); ev.target.disabled = false; }
        } }));
      }
      const note = r.review_note && r.status !== 'draft' && r.status !== 'submitted'
        ? el('div', { class: 'pp-note' }, [el('strong', { text: 'From the Mining Division' }), el('p', { text: r.review_note })]) : null;
      grid.append(el('article', { class: 'pp-tile' }, [
        el('div', { class: 'pp-tile-media' }, [
          el('img', { src: P.image(r.commodity), alt: '', loading: 'lazy' }),
          el('div', { class: 'pp-tile-over' }, [ownerPill(r.status), el('span', { class: 'pp-ref', text: T7P.reference(r.id) })]),
          el('div', { class: 'pp-tile-title' }, [
            el('h3', { text: r.name || 'Untitled project' }),
            el('p', { text: [commodityOf(r), r.province].filter(Boolean).join(' · ') || 'Details still to add' })
          ])
        ]),
        el('div', { class: 'pp-tile-body' }, [
          T7P.tracker(r.status, true),
          el('p', { class: 'pp-date', text: r.submitted_at ? 'Submitted ' + T7P.date(r.submitted_at) : 'Last saved ' + T7P.date(r.updated_at) }),
          note, actions
        ])
      ]));
    }
    grid.append(el('a', { class: 'pp-tile pp-tile-new', href: 'project-profile.html' }, [
      el('img', { src: 'images/mine-projects/req-ground.webp', alt: '', loading: 'lazy' }),
      el('div', {}, [
        el('span', { class: 'pp-plus', 'aria-hidden': 'true', text: '+' }),
        el('h3', {}, [rows.length ? 'Start another project' : 'Start your first project', el('br'), el('em', { text: 'About 20 minutes.' })]),
        el('p', { text: 'Have your rights status, coordinates, technical data and documents to hand. Your draft saves as you go.' }),
        el('span', { class: 'btn btn-light', text: 'Start a New Project' })
      ])
    ]));

    const next = el('section', { class: 'pp-band' }, [el('div', { class: 'pp-band-inner' }, [
      el('div', { class: 'pp-band-head' }, [el('p', { class: 'eyebrow', text: 'What happens next' }), el('h2', { class: 'section-title' }, ['Every project,', el('br'), el('em', { text: 'reviewed by people.' })])]),
      el('ol', { class: 'pp-steps' }, [
        ['01', 'You submit', 'Your profile goes to the Mining Division in Kimberley.'],
        ['02', 'Awaiting approval', 'The team reviews the rights, ground, stage and what you need.'],
        ['03', 'Changes, if needed', 'If something is missing, the project reopens for you to update.'],
        ['04', 'Decision', 'You see the outcome and the team contacts you about next steps.']
      ].map(([n, h, p]) => el('li', {}, [el('span', { text: n }), el('h3', { text: h }), el('p', { text: p })])))
    ])]);

    show([bar, grid, next]);
  }

  /* ---------------- Admin ---------------- */
  const FILTERS = [
    ['review', 'To review', s => s === 'submitted' || s === 'under_review'],
    ['changes', 'Changes requested', s => s === 'changes_requested'],
    ['approved', 'Approved', s => s === 'approved'],
    ['rejected', 'Declined', s => s === 'rejected'],
    ['draft', 'Drafts', s => s === 'draft'],
    ['all', 'All', () => true]
  ];

  function ring(score, rating) {
    return el('span', { class: 'pp-ring r-' + rating.toLowerCase().replace(/\s+/g, '-'), style: '--v:' + score, title: 'Opportunity Score ' + score + '/100 · ' + rating }, [el('b', { text: String(score) })]);
  }

  async function renderAdmin(profile, filter) {
    filter = filter || new URLSearchParams(location.search).get('show') || 'review';
    const projects = T7P.unwrap(await client.from('mine_projects').select('*').order('submitted_at', { ascending: false, nullsFirst: false }));
    const ids = [...new Set(projects.map(p => p.owner_id))];
    const owners = ids.length ? T7P.unwrap(await client.from('profiles').select('id,first_name,last_name,email,company').in('id', ids)) : [];
    const ownerOf = id => owners.find(o => o.id === id) || {};
    const count = key => projects.filter(p => FILTERS.find(f => f[0] === key)[2](p.status)).length;

    T7P.hero({ eyebrow: 'Mining Division · Admin', title: 'Project submissions.', em: 'Review. Decide. Match.', sub: count('review') ? count('review') + (count('review') === 1 ? ' project is' : ' projects are') + ' waiting for your decision.' : 'Nothing is waiting for a decision right now.', image: 'images/hero-banner3.jpg' });

    const go = key => { history.replaceState(null, '', '?show=' + key); renderAdmin(profile, key); };
    const stats = el('div', { class: 'pp-stats' }, FILTERS.slice(0, 4).map(([key, text]) => el('button', {
      type: 'button', class: 'pp-stat' + (key === filter ? ' is-active' : '') + ' k-' + key, onclick: () => go(key)
    }, [el('strong', { text: String(count(key)) }), el('span', { text: text })])));

    const bar = el('div', { class: 'pp-toolbar' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: 'Signed in as ' + profile.email }), el('h2', { class: 'pp-h2', text: (FILTERS.find(f => f[0] === filter) || FILTERS[0])[1] })]),
      el('div', { class: 'pp-toolbar-actions' }, [
        el('div', { class: 'pp-seg pp-seg-small' }, FILTERS.slice(4).map(([key, text]) => el('button', { type: 'button', class: key === filter ? 'is-active' : '', text: text + ' · ' + count(key), onclick: () => go(key) }))),
        el('a', { class: 'btn btn-ghost-dark', href: 'admin.html', text: 'Admin Dashboard' }),
        el('button', { type: 'button', class: 'btn btn-ghost-dark', text: 'Sign Out', onclick: signOut })
      ])
    ]);

    const test = (FILTERS.find(f => f[0] === filter) || FILTERS[0])[2];
    const shown = projects.filter(p => test(p.status));
    const list = el('div', { class: 'pp-queue' });
    if (!shown.length) list.append(el('div', { class: 'pp-empty' }, [el('h3', { text: 'All clear.' }), el('p', { text: 'There are no projects in this list.' })]));
    for (const p of shown) {
      const o = ownerOf(p.owner_id);
      const s = P.opportunityScore(p);
      list.append(el('a', { class: 'pp-row', href: 'project-profile.html?id=' + p.id }, [
        el('img', { class: 'pp-row-img', src: P.image(p.commodity), alt: '', loading: 'lazy' }),
        el('div', { class: 'pp-row-main' }, [
          el('strong', { text: p.name || 'Untitled project' }),
          el('span', { text: [commodityOf(p), p.province].filter(Boolean).join(' · ') }),
          el('span', { class: 'pp-row-owner', text: (T7P.name(o) || 'Unknown owner') + (o.email ? ' · ' + o.email : '') })
        ]),
        el('div', { class: 'pp-row-cap' }, [el('span', { class: 'pp-k', text: 'Capital' }), el('span', { text: P.label('capital_band', p.capital_band) || '—' })]),
        ring(s.score, s.rating),
        el('div', { class: 'pp-row-status' }, [adminPill(p.status), el('span', { class: 'pp-date', text: p.submitted_at ? T7P.date(p.submitted_at) : 'Not submitted' })]),
        el('span', { class: 'pp-row-go', 'aria-hidden': 'true', text: '→' })
      ]));
    }
    show([stats, bar, list]);
  }

  async function signOut() { await T7P.signOut(); renderSignedOut('signin', 'You are signed out.'); window.scrollTo(0, 0); }

  async function route() {
    if (recovering) { renderRecovery(); return; }
    const session = await T7P.session();
    if (!session) { renderSignedOut(new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'); return; }
    const profile = await T7P.profile(true);
    if (profile.status === 'suspended') {
      await T7P.signOut();
      renderSignedOut('signin', 'This account is suspended. Please contact the team.');
      return;
    }
    if (profile.is_admin) await renderAdmin(profile);
    else await renderOwner(profile);
  }

  try { await route(); }
  catch (e) {
    console.error(e);
    show(el('div', { class: 'pp-card pp-narrow' }, [el('h2', { text: 'Unable to load the project portal' }), el('p', { text: T7P.friendly(e) })]));
  }
})();
