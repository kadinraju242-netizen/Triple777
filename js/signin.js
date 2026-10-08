/* ============================================================
   Triple 7 Holdings — sign in / create account
   ------------------------------------------------------------
   The gate in front of the Trade Desk. One page, a handful of
   screens:

     sign in          email + password, or Google
     create account   buyer or seller, then a confirmation email
     check your inbox shown until the emailed link is clicked
     finish profile   after a first Google sign-in (Google cannot
                      tell us buyer vs seller)
     new password     after following a "forgot password" link

   Once signed in, nobody stays here: buyers go to the board,
   sellers to their dashboard, and an admin account to the admin
   dashboard. There is no separate admin door.
   ============================================================ */
(function () {
  const root      = document.getElementById('signin-root');
  const tabs      = document.getElementById('auth-tabs');
  const tabSignin = document.getElementById('tab-signin');
  const tabSignup = document.getElementById('tab-signup');
  const titleEl   = document.getElementById('desk-title');
  const subEl     = document.getElementById('desk-sub');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const isRecovery = hash.get('type') === 'recovery';
  const linkError = hash.get('error_description');

  let mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
  let role = params.get('role') === 'seller' ? 'seller' : 'buyer';

  /* Only ever follow ?next= to another page of this site. */
  const rawNext = params.get('next') || '';
  /* Some hosts (Netlify) show pages without ".html" (/trade, /lot?id=…),
     so the page name is accepted with or without it. */
  const next = /^[a-z0-9-]+(\.html)?([?#].*)?$/i.test(rawNext) ? rawNext : '';
  const nextPage = next.split(/[?#]/)[0].toLowerCase().replace(/\.html$/, '');

  const esc = T7.esc;

  /* "Continue with Google" is switched off. To bring it back, set up
     Google in Supabase (see SETUP.md), then add  googleSignIn: true  to
     js/config.js. */
  const GOOGLE = T7.backend === 'supabase' && (window.T7_CONFIG || {}).googleSignIn === true;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function head(title, sub) {
    titleEl.textContent = title;
    subEl.textContent = sub;
    document.title = title + ' — Trade Desk — Triple 7 Holdings';
  }

  function showTabs(on) {
    tabs.hidden = !on;
    tabSignin.classList.toggle('is-on', mode === 'signin');
    tabSignup.classList.toggle('is-on', mode === 'signup');
    tabSignin.setAttribute('aria-selected', mode === 'signin' ? 'true' : 'false');
    tabSignup.setAttribute('aria-selected', mode === 'signup' ? 'true' : 'false');
  }

  /* Where an account lands after signing in. Everyone goes to their own
     home (buyer: the board, seller: seller dashboard, admin: admin
     dashboard) unless they were on their way to something specific. */
  function destination(profile) {
    const home = T7.auth.homeFor(profile.role);
    if (!next) return home;
    if (profile.role === 'admin') return home;            // the board and lot pages are not for admins
    if (nextPage === 'lot') return next;
    if (nextPage === 'trade' && profile.role === 'buyer') return next;
    if (nextPage === home.replace(/\.html$/, '')) return next;
    return home;
  }

  function route(profile) {
    if (profile.status === 'suspended') return suspended(profile);
    if (!profile.role) return finishProfile(profile);
    showTabs(false);
    head('Signed in', 'Taking you to ' + (profile.role === 'buyer' ? 'the Trade Desk' : 'your dashboard') + '…');
    root.innerHTML = '<p class="auth-wait">One moment…</p>';
    location.replace(destination(profile));
  }

  /* ---------- Small form helpers ---------- */
  function setError(form, name, message) {
    const field = form.elements[name];
    if (!field) return;
    const wrap = (field.closest ? field : field[0]).closest('.field');
    const err = wrap && wrap.querySelector('.field-error');
    if (wrap) wrap.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
  }

  function formError(message) {
    const box = document.getElementById('form-error');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  function busy(button, label) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = Boolean(label);
    button.textContent = label || button.dataset.label;
  }

  function clearOnInput(form) {
    form.addEventListener('input', e => {
      if (e.target.name) setError(form, e.target.name, '');
      formError('');
    });
  }

  const GOOGLE_ICON =
    '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">' +
      '<path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.300-2.100 3.500-5.200 3.500-8.700z"/>' +
      '<path fill="#34A853" d="M12 24c3.200 0 6-1.100 8-2.900l-3.900-3c-1.100.700-2.500 1.200-4.100 1.200-3.100 0-5.800-2.100-6.700-5H1.300v3.100A12 12 0 0 0 12 24z"/>' +
      '<path fill="#FBBC05" d="M5.300 14.300a7.200 7.200 0 0 1 0-4.600V6.600H1.300a12 12 0 0 0 0 10.800l4-3.100z"/>' +
      '<path fill="#EA4335" d="M12 4.800c1.800 0 3.300.600 4.600 1.800L20 3.100A12 12 0 0 0 1.300 6.600l4 3.100c.900-2.900 3.600-4.900 6.700-4.900z"/>' +
    '</svg>';

  function googleButton(label) {
    return '<button type="button" class="btn-google" id="google">' + GOOGLE_ICON + '<span>' + label + '</span></button>' +
           '<div class="auth-divider"><span>or use your email</span></div>';
  }

  function wireGoogle(getRole) {
    const btn = document.getElementById('google');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await T7.auth.signInWithGoogle(getRole(), next);
      } catch (e) {
        btn.disabled = false;
        formError(e.message);
      }
    });
  }

  function passwordField(id, label, autocomplete, hint) {
    return '<div class="field">' +
             '<label for="' + id + '">' + label + '</label>' +
             '<div class="pw-wrap">' +
               '<input id="' + id + '" name="' + id + '" type="password" autocomplete="' + autocomplete + '" required>' +
               '<button type="button" class="pw-toggle" data-pw="' + id + '" aria-label="Show password">Show</button>' +
             '</div>' +
             (hint ? '<p class="field-hint">' + hint + '</p>' : '') +
             '<p class="field-error"></p>' +
           '</div>';
  }

  root.addEventListener('click', e => {
    const t = e.target.closest('[data-pw]');
    if (!t) return;
    const input = document.getElementById(t.dataset.pw);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    t.textContent = show ? 'Hide' : 'Show';
    t.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  function rolePicker(selected) {
    const card = (value, title, text) =>
      '<label class="role-card">' +
        '<input type="radio" name="role" value="' + value + '"' + (selected === value ? ' checked' : '') + '>' +
        '<span class="role-title">' + title + '</span>' +
        '<span class="role-text">' + text + '</span>' +
      '</label>';
    return '<fieldset class="role-pick"><legend>I am here to</legend>' +
             card('buyer', 'Buy', 'Browse lots and send enquiries to sellers.') +
             card('seller', 'Sell', 'List diamonds, gold and gemstones for approval.') +
           '</fieldset>';
  }

  function profileFields(p, withCompany) {
    const countries = T7.catalog.countries.map(c =>
      '<option' + ((p.country || 'South Africa') === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    return '<div class="form-row">' +
             '<div class="field"><label for="first_name">First name</label><input id="first_name" name="first_name" type="text" autocomplete="given-name" value="' + esc(p.first_name || '') + '" required><p class="field-error"></p></div>' +
             '<div class="field"><label for="last_name">Surname</label><input id="last_name" name="last_name" type="text" autocomplete="family-name" value="' + esc(p.last_name || '') + '" required><p class="field-error"></p></div>' +
           '</div>' +
           '<div class="form-row">' +
             '<div class="field"><label for="phone">Phone</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="+27 82 000 0000" value="' + esc(p.phone || '') + '" required><p class="field-error"></p></div>' +
             '<div class="field"><label for="country">Country</label><select id="country" name="country" autocomplete="country-name">' + countries + '</select></div>' +
           '</div>' +
           '<div class="field" id="company-field"' + (withCompany ? '' : ' hidden') + '>' +
             '<label for="company">Company or trading name <span class="opt">(optional)</span></label>' +
             '<input id="company" name="company" type="text" autocomplete="organization" value="' + esc(p.company || '') + '">' +
           '</div>';
  }

  function validateProfile(form) {
    let ok = true;
    const need = (name, test, message) => {
      const bad = !test(form.elements[name].value.trim());
      setError(form, name, bad ? message : '');
      if (bad && ok) { form.elements[name].focus(); ok = false; }
    };
    need('first_name', v => v.length >= 2, 'Please enter your first name.');
    need('last_name', v => v.length >= 2, 'Please enter your surname.');
    need('phone', v => v.replace(/\D/g, '').length >= 9, 'Please enter a phone number we can reach you on.');
    return ok;
  }

  function wireRole(form) {
    form.addEventListener('change', e => {
      if (e.target.name !== 'role') return;
      role = e.target.value;
      document.getElementById('company-field').hidden = role !== 'seller';
    });
  }

  /* ---------- Screens ---------- */
  async function notConnected() {
    showTabs(false);
    head('Sign In', 'The Trade Desk needs its database before anyone can sign in.');
    /* If the server is up but MySQL is not, it says exactly why. */
    let reason = '';
    try { const r = await fetch('/api/ping'); if (r.status === 503) reason = (await r.json()).error || ''; } catch (e) {}
    root.innerHTML =
      '<div class="notice">' +
        '<strong>The database is not connected.</strong> ' +
        (reason ? esc(reason)
                : 'Start the site with <code>node serve.js</code> and open <code>http://localhost:4180</code>. See <code>SETUP.md</code>.') +
      '</div>';
  }

  function signinForm(message) {
    mode = 'signin';
    showTabs(true);
    head('Sign In', 'Sign in to browse lots, send enquiries and manage your listings.');
    root.innerHTML =
      (message ? '<div class="notice" style="margin-bottom:22px">' + message + '</div>' : '') +
      (!GOOGLE ? '' : googleButton('Continue with Google')) +
      '<form class="form" id="auth-form" novalidate>' +
        '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" required><p class="field-error"></p></div>' +
        passwordField('password', 'Password', 'current-password') +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Sign In</button>' +
      '</form>' +
      '<p class="auth-foot"><button type="button" class="linklike" id="forgot">Forgot your password?</button>' +
      '<span>New here? <button type="button" class="linklike" id="to-signup">Create an account</button></span></p>';

    const form = document.getElementById('auth-form');
    clearOnInput(form);
    wireGoogle(() => null);
    document.getElementById('to-signup').addEventListener('click', () => signupForm());
    document.getElementById('forgot').addEventListener('click', () => forgotForm(form.elements.email.value.trim()));

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { setError(form, 'email', 'Enter your email address.'); form.elements.email.focus(); return; }
      if (!password) { setError(form, 'password', 'Enter your password.'); form.elements.password.focus(); return; }

      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Signing in…');
      try {
        const profile = await T7.auth.signIn(email, password);
        if (!profile) throw new Error('We could not load your account. Please try again.');
        route(profile);
      } catch (err) {
        busy(btn, '');
        if (/confirm your email/i.test(err.message)) return verifySent(email, true);
        formError(err.message);
      }
    });
  }

  function signupForm() {
    mode = 'signup';
    showTabs(true);
    head('Create Account', 'One account, as a buyer or as a seller. It takes about a minute.');
    root.innerHTML =
      '<form class="form" id="auth-form" novalidate>' +
        rolePicker(role) +
        (!GOOGLE ? '' : googleButton('Sign up with Google')) +
        profileFields({}, role === 'seller') +
        '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" required><p class="field-error"></p></div>' +
        passwordField('password', 'Password', 'new-password', 'At least 8 characters.') +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Create Account</button>' +
        '<p class="field-hint" style="text-align:center">We will email you a link to confirm your address.</p>' +
      '</form>' +
      '<p class="auth-foot"><span>Already have an account? <button type="button" class="linklike" id="to-signin">Sign in</button></span></p>';

    const form = document.getElementById('auth-form');
    clearOnInput(form);
    wireRole(form);
    wireGoogle(() => role);
    document.getElementById('to-signin').addEventListener('click', () => signinForm());

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateProfile(form)) return;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { setError(form, 'email', 'That email address does not look right.'); form.elements.email.focus(); return; }
      if (password.length < 8) { setError(form, 'password', 'Use at least 8 characters.'); form.elements.password.focus(); return; }

      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Creating your account…');
      try {
        const result = await T7.auth.signUp({
          role: role, email: email, password: password,
          first_name: form.elements.first_name.value.trim(),
          last_name: form.elements.last_name.value.trim(),
          phone: form.elements.phone.value.trim(),
          country: form.elements.country.value,
          company: role === 'seller' ? form.elements.company.value.trim() : ''
        }, next);
        if (result.needsVerification) verifySent(email, false, result.devLink);
        else route(result.profile);
      } catch (err) {
        busy(btn, '');
        formError(err.message);
      }
    });
  }

  function verifySent(email, wasSigningIn, devLink) {
    showTabs(false);
    head('Check Your Inbox', 'One click on the link we sent and you are in.');
    root.innerHTML =
      '<div class="auth-state">' +
        '<h2>Confirm your email</h2>' +
        '<p>' + (wasSigningIn ? 'This account has not been confirmed yet. ' : '') +
          'We sent a link to <strong>' + esc(email) + '</strong>. Open it on this device to finish signing in. ' +
          'It can take a minute to arrive — check your spam folder too.</p>' +
        '<div class="notice" id="dev-link" style="margin-bottom:22px"' + (devLink ? '' : ' hidden') + '>' +
          '<strong>Running on your own computer: no real email is sent.</strong> The link is also printed in the terminal. ' +
          '<a class="textlink" id="dev-link-a" href="' + esc(devLink || '#') + '">Open the confirmation link</a></div>' +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<div class="action-row">' +
          '<button type="button" class="btn-desk" id="resend">Send It Again</button>' +
          '<button type="button" class="btn-line" id="back">Use A Different Email</button>' +
        '</div>' +
      '</div>';
    document.getElementById('back').addEventListener('click', () => (wasSigningIn ? signinForm() : signupForm()));
    const btn = document.getElementById('resend');
    btn.addEventListener('click', async () => {
      busy(btn, 'Sending…');
      try {
        const again = await T7.auth.resendVerification(email, next);
        if (again && again.devLink) { document.getElementById('dev-link-a').href = again.devLink; document.getElementById('dev-link').hidden = false; }
        busy(btn, '');
        T7.toast('Sent again to ' + email);
      } catch (err) {
        busy(btn, '');
        formError(err.message);
      }
    });
  }

  function forgotForm(prefill) {
    showTabs(false);
    head('Reset Password', 'We will email you a link to choose a new one.');
    root.innerHTML =
      '<form class="form" id="auth-form" novalidate>' +
        '<div class="field"><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="username" value="' + esc(prefill || '') + '" required><p class="field-error"></p></div>' +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Email Me A Reset Link</button>' +
      '</form>' +
      '<p class="auth-foot"><span><button type="button" class="linklike" id="to-signin">Back to sign in</button></span></p>';
    const form = document.getElementById('auth-form');
    clearOnInput(form);
    document.getElementById('to-signin').addEventListener('click', () => signinForm());
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      if (!EMAIL.test(email)) { setError(form, 'email', 'Enter your email address.'); return; }
      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Sending…');
      try {
        await T7.auth.sendPasswordReset(email);
        signinForm('<strong>Check your inbox.</strong> If ' + esc(email) + ' has an account, a reset link is on its way.');
      } catch (err) {
        busy(btn, '');
        formError(err.message);
      }
    });
  }

  function newPasswordForm(profile) {
    showTabs(false);
    head('New Password', 'Choose a new password for ' + (profile.email || 'your account') + '.');
    root.innerHTML =
      '<form class="form" id="auth-form" novalidate>' +
        passwordField('password', 'New password', 'new-password', 'At least 8 characters.') +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Save And Continue</button>' +
      '</form>';
    const form = document.getElementById('auth-form');
    clearOnInput(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const password = form.elements.password.value;
      if (password.length < 8) { setError(form, 'password', 'Use at least 8 characters.'); return; }
      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Saving…');
      try {
        await T7.auth.setPassword(password);
        history.replaceState(null, '', location.pathname);
        T7.toast('Password updated');
        route(profile);
      } catch (err) {
        busy(btn, '');
        formError(err.message);
      }
    });
  }

  /* First sign-in with Google: we have a name and an email, but not
     whether this is a buyer or a seller. */
  function finishProfile(profile) {
    showTabs(false);
    role = T7.auth.pendingRole() || role;
    head('Almost There', 'Tell us how you will use the Trade Desk.');
    root.innerHTML =
      '<form class="form" id="auth-form" novalidate>' +
        rolePicker(role) +
        profileFields(profile, role === 'seller') +
        '<p class="form-error" id="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Continue</button>' +
      '</form>' +
      '<p class="auth-foot"><span>Signed in as ' + esc(profile.email) + '. <button type="button" class="linklike" id="signout">Sign out</button></span></p>';
    const form = document.getElementById('auth-form');
    clearOnInput(form);
    wireRole(form);
    document.getElementById('signout').addEventListener('click', async () => { await T7.auth.signOut(); signinForm(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!validateProfile(form)) return;
      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Saving…');
      try {
        const updated = await T7.auth.completeProfile({
          role: role,
          first_name: form.elements.first_name.value.trim(),
          last_name: form.elements.last_name.value.trim(),
          phone: form.elements.phone.value.trim(),
          country: form.elements.country.value,
          company: role === 'seller' ? form.elements.company.value.trim() : ''
        });
        route(updated);
      } catch (err) {
        busy(btn, '');
        formError(err.message);
      }
    });
  }

  function suspended(profile) {
    showTabs(false);
    head('Account On Hold', 'This account cannot use the Trade Desk at the moment.');
    root.innerHTML =
      '<div class="auth-state">' +
        '<h2>Your account is on hold</h2>' +
        '<p>' + esc(profile.email) + ' has been paused by the desk. Please ' +
          '<a class="textlink" href="contact.html">contact us</a> if you think this is a mistake.</p>' +
        '<div class="action-row"><button type="button" class="btn-line" id="signout">Sign Out</button></div>' +
      '</div>';
    document.getElementById('signout').addEventListener('click', async () => { await T7.auth.signOut(); signinForm(); });
  }

  /* ---------- Boot ---------- */
  tabSignin.addEventListener('click', () => signinForm());
  tabSignup.addEventListener('click', () => signupForm());

  (async function boot() {
    if (!(await T7.backendReady())) return notConnected();

    showTabs(false);
    root.innerHTML = '<p class="auth-wait">One moment…</p>';

    if (params.get('signout')) {
      await T7.auth.signOut();
      history.replaceState(null, '', location.pathname);
      T7.toast('Signed out');
      return signinForm();
    }

    let profile = null;
    try {
      profile = await T7.auth.ready();
    } catch (e) {
      console.error(e);
    }

    if (profile && isRecovery) return newPasswordForm(profile);
    if (profile) return route(profile);

    if (linkError) {
      history.replaceState(null, '', location.pathname + location.search);
      return signinForm('<strong>That link did not work.</strong> ' + esc(linkError.replace(/\+/g, ' ')) +
        '. Sign in below, or ask for a new link.');
    }
    if (mode === 'signup') signupForm();
    else signinForm();
  })();
})();
