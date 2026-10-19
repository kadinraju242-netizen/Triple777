/* ============================================================
   Mine projects — sign-in for the project portal
   ------------------------------------------------------------
   Same pattern as the investor portal (js/investor-live.js): its own
   browser session (storage key "t7.project.auth"), so signing in or
   out here does not touch the Trade or investor sessions.

   Supabase Auth keeps one identity per email, so ANY Triple 7 login
   works here: a Trade buyer/seller, an investor, an admin, or a new
   project-only account made on project-portal.html with just a name,
   surname, email and password. What each account may read or change
   is decided by the database (supabase/13_mine_projects.sql).
   ============================================================ */
(function () {
  'use strict';
  const cfg = window.T7_CONFIG || {};
  const T7P = window.T7P = window.T7P || {};
  let clientPromise = null;
  let profileCache = null;

  T7P.configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase);

  T7P.client = function () {
    if (!T7P.configured) return Promise.reject(new Error('Project sign-in is not configured yet. Please contact the team.'));
    if (!clientPromise) {
      clientPromise = Promise.resolve(window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
        auth: { storageKey: 't7.project.auth', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      }));
    }
    return clientPromise;
  };

  T7P.friendly = function (error) {
    const msg = (error && error.message) || String(error || '');
    if (/invalid login credentials/i.test(msg)) return 'That email and password do not match a Triple 7 account.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link we sent.';
    if (/password should be at least|weak password/i.test(msg)) return 'Choose a longer password (at least 8 characters).';
    if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'We could not reach the server. Check your connection and try again.';
    if (/relation .*mine_projects.* does not exist|schema cache|PGRST205/i.test(msg)) return 'Project submissions are not switched on yet. Please contact the team.';
    if (/row-level security|permission denied/i.test(msg)) return 'Your account is not allowed to do that.';
    return msg || 'Something went wrong. Please try again.';
  };

  T7P.unwrap = function (result) { if (result.error) throw result.error; return result.data; };

  T7P.session = async function () {
    const client = await T7P.client();
    const { data } = await client.auth.getSession();
    return data && data.session ? data.session : null;
  };

  /* The signed-in person's profile (name, email, admin or not). Every
     account has a profiles row, made by the sign-up trigger. */
  T7P.profile = async function (refresh) {
    if (profileCache && !refresh) return profileCache;
    const client = await T7P.client();
    const session = await T7P.session();
    if (!session) { profileCache = null; return null; }
    const { data } = await client.from('profiles').select('id,email,role,status,first_name,last_name,phone,company').eq('id', session.user.id).maybeSingle();
    profileCache = Object.assign({ id: session.user.id, email: session.user.email }, data || {});
    profileCache.is_admin = profileCache.role === 'admin' && profileCache.status !== 'suspended';
    return profileCache;
  };

  T7P.portalUrl = function () { return new URL('project-portal.html', location.href).href; };

  T7P.signIn = async function (email, password) {
    const client = await T7P.client();
    T7P.unwrap(await client.auth.signInWithPassword({ email: email, password: password }));
    return T7P.profile(true);
  };

  /* Returns 'signed-in', 'check-email', or 'exists'. */
  T7P.signUp = async function (f) {
    const client = await T7P.client();
    const result = T7P.unwrap(await client.auth.signUp({
      email: f.email, password: f.password,
      options: {
        emailRedirectTo: T7P.portalUrl(),
        data: { portal: 'project', first_name: f.first_name, last_name: f.last_name }
      }
    }));
    /* An empty identities list is how Supabase says "that email already
       has an account" without confirming it to whoever is asking. */
    if (result.user && Array.isArray(result.user.identities) && !result.user.identities.length) return 'exists';
    if (result.session) { await T7P.profile(true); return 'signed-in'; }
    return 'check-email';
  };

  T7P.resetPassword = async function (email) {
    const client = await T7P.client();
    T7P.unwrap(await client.auth.resetPasswordForEmail(email, { redirectTo: T7P.portalUrl() }));
  };

  T7P.setPassword = async function (password) {
    const client = await T7P.client();
    T7P.unwrap(await client.auth.updateUser({ password: password }));
  };

  T7P.signOut = async function () {
    const client = await T7P.client();
    await client.auth.signOut({ scope: 'local' });
    profileCache = null;
  };

  T7P.name = function (p) {
    if (!p) return '';
    return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company || p.email || '';
  };

  /* Small DOM helper shared by the two project pages. */
  T7P.el = function (tag, attrs, children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children || [])) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  };

  /* The photo header at the top of both project pages. */
  T7P.hero = function (o) {
    const eb = document.getElementById('pp-hero-eyebrow');
    const title = document.getElementById('pp-hero-title');
    const sub = document.getElementById('pp-hero-sub');
    const img = document.getElementById('pp-hero-img');
    if (eb && o.eyebrow) eb.textContent = o.eyebrow;
    if (title && o.title) {
      title.replaceChildren(document.createTextNode(o.title));
      if (o.em) title.append(document.createElement('br'), Object.assign(document.createElement('em'), { textContent: o.em }));
    }
    if (sub) { sub.textContent = o.sub || ''; sub.hidden = !o.sub; }
    if (img && o.image) img.src = o.image;
    if (o.title) document.title = o.title.replace(/\.$/, '') + ' — Triple 7 Holdings';
  };

  /* Owner-facing progress: Draft → Submitted → Awaiting approval → Decision. */
  T7P.tracker = function (status, compact) {
    const decided = status === 'approved' || status === 'rejected';
    const steps = [
      ['Draft', 'Profile in progress'],
      ['Submitted', 'Sent to the division'],
      ['Awaiting approval', 'The team reviews every detail'],
      [status === 'approved' ? 'Approved' : status === 'rejected' ? 'Not approved' : status === 'changes_requested' ? 'Changes requested' : 'Decision',
        status === 'approved' ? 'The team will contact you' : status === 'rejected' ? 'See the team’s message' : status === 'changes_requested' ? 'Update and resubmit' : 'Approved or not']
    ];
    const at = status === 'draft' ? 0 : status === 'submitted' ? 2 : status === 'under_review' ? 2 : 3;
    const ol = T7P.el('ol', { class: 'pp-track' + (compact ? ' is-compact' : '') + ' t-' + status });
    steps.forEach(([name, note], i) => {
      const state = i < at || (i === at && decided) ? 'is-done' : i === at ? 'is-current' : '';
      ol.append(T7P.el('li', { class: state + (i === 3 ? ' is-decision' : '') }, [
        T7P.el('span', { class: 'pp-track-dot', 'aria-hidden': 'true' }),
        T7P.el('strong', { text: name }), compact ? null : T7P.el('small', { text: note })
      ]));
    });
    return ol;
  };

  T7P.reference = function (id) { return 'MP-' + String(id || '').slice(0, 6).toUpperCase(); };
  T7P.date = function (v) {
    if (!v) return '';
    return new Date(v).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  };
})();
