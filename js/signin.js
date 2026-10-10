/* ============================================================
   Triple 7 Holdings — sign in / create account
   ------------------------------------------------------------
   The gate in front of the Trade Desk. Side by side:

     Sign in             email + password, then
                         [Sign In As Buyer]  [Sign In As Seller]
     Create an account   name, phone, email, password, then
                         [Sign Up As Buyer]  [Sign Up As Seller]

   ONE account can buy and sell. Signing in as a seller with an
   account that so far only buys offers to add selling to that same
   account (same email, same password), and the other way round.
   The Account menu switches between the two later.

   Other screens on this page:
     check your inbox   until the emailed confirmation link is clicked
     add the other side "start selling with this account?"
     finish profile     after a first Google sign-in (if switched on)
     new password       after a "forgot password" link

   Once signed in, nobody stays here: buyers go to the board,
   sellers to their dashboard, an admin account to the admin
   dashboard. There is no separate admin door.

   Addresses this page understands:
     ?as=buyer|seller   switch to that side (adding it if needed)
     ?mode=signup       start at "Create an account"
     ?role=seller       highlight the seller buttons
     ?next=page         where to go afterwards
     ?signout=1         sign out
   ============================================================ */
(function () {
  const root    = document.getElementById('signin-root');
  const titleEl = document.getElementById('desk-title');
  const subEl   = document.getElementById('desk-sub');
  const wrap    = document.querySelector('.auth-wrap');
  if (!root) return;

  /* Older copies of signin.html carry their own (hidden) tabs; the tabs
     are now drawn inside the card below, so the old ones go. */
  const oldTabs = document.getElementById('auth-tabs');
  if (oldTabs) oldTabs.remove();

  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const isRecovery = hash.get('type') === 'recovery';
  const linkError = hash.get('error_description');

  const startAt = params.get('mode') === 'signup' ? 'signup' : 'signin';
  const wantedAs = ['buyer', 'seller'].indexOf(params.get('as')) !== -1 ? params.get('as') : null;
  const leaning = wantedAs || (params.get('role') === 'seller' ? 'seller' : 'buyer');

  /* Only ever follow ?next= to another page of this site. Some hosts
     (Netlify) show pages without ".html", so both forms are accepted. */
  const rawNext = params.get('next') || '';
  const next = /^[a-z0-9-]+(\.html)?([?#].*)?$/i.test(rawNext) ? rawNext : '';
  const nextPage = next.split(/[?#]/)[0].toLowerCase().replace(/\.html$/, '');

  const esc = T7.esc;
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const SIDE = { buyer: 'Buyer', seller: 'Seller' };
  const DOING = { buyer: 'buying', seller: 'selling' };

  /* "Continue with Google" is switched off. To bring it back, set up
     Google in Supabase (see SETUP.md), then add  googleSignIn: true  to
     js/config.js. */
  const GOOGLE = T7.backend === 'supabase' && (window.T7_CONFIG || {}).googleSignIn === true;

  function head(title, sub) {
    titleEl.textContent = title;
    subEl.textContent = sub;
    document.title = title + ' — Trade Desk — Triple 7 Holdings';
  }

  /* Two cards side by side, or one card in the middle. */
  function layout(wide) {
    if (wrap) wrap.classList.toggle('is-split', Boolean(wide));
  }

  function single(html) {
    layout(false);
    root.innerHTML = '<div class="auth-card">' + html + '</div>';
  }

  /* Where an account lands after signing in: its own home (buyer: the
     board, seller: seller dashboard, admin: admin dashboard) unless it
     was on its way to something specific. */
  function destination(profile) {
    const home = T7.auth.homeFor(profile.role);
    if (!next) return home;
    if (profile.role === 'admin') return home;            // the board and lot pages are not for admins
    if (nextPage === 'lot') return next;
    if (nextPage === 'trade' && profile.role === 'buyer') return next;
    if (nextPage === home.replace(/\.html$/, '')) return next;
    return home;
  }

  function go(profile) {
    layout(false);
    head('Signed in', 'Taking you to ' + (profile.role === 'buyer' ? 'the Trade Desk' : 'your dashboard') + '…');
    root.innerHTML = '<p class="auth-wait">One moment…</p>';
    location.replace(destination(profile));
  }

  /* Signed in, and wanting to act as `side` (buyer/seller, or null for
     "whatever this account already is"). */
  function route(profile, side) {
    if (profile.status === 'suspended') return suspended(profile);
    if (profile.role === 'admin') return go(profile);
    const canBuy = T7.auth.can('buyer'), canSell = T7.auth.can('seller');
    if (!canBuy && !canSell) return finishProfile(profile, side);
    if (side && !T7.auth.can(side)) return addSide(profile, side);
    if (side) profile = T7.auth.setMode(side);
    go(profile);
  }

  /* ---------- Small form helpers ---------- */
  function setError(form, name, message) {
    const field = form.elements[name];
    if (!field) return;
    const box = field.closest('.field');
    const err = box && box.querySelector('.field-error');
    if (box) box.classList.toggle('is-invalid', Boolean(message));
    if (err) err.textContent = message || '';
  }

  function formError(form, message) {
    const box = form.querySelector('.form-error');
    if (!box) return;
    box.textContent = message || '';
    box.hidden = !message;
  }

  function busy(button, label) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = Boolean(label);
    button.textContent = label || button.dataset.label;
  }

  function lock(form, on) {
    form.querySelectorAll('button[type=submit]').forEach(b => { b.disabled = on; });
  }

  function clearOnInput(form) {
    form.addEventListener('input', e => {
      if (e.target.name) setError(form, e.target.name, '');
      formError(form, '');
    });
  }

  function passwordField(id, label, autocomplete, hint) {
    return '<div class="field">' +
             '<label for="' + id + '">' + label + '</label>' +
             '<div class="pw-wrap">' +
               '<input id="' + id + '" name="password" type="password" autocomplete="' + autocomplete + '" required>' +
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

  /* The pair of buttons at the bottom of each form. Both submit the
     form; which one was pressed decides buyer or seller. */
  function sideButtons(verb) {
    const button = side =>
      '<button type="submit" name="side" value="' + side + '" class="btn-desk' + (side === 'seller' ? ' is-seller' : '') +
        (side === leaning ? ' is-leaning' : '') + '">' + verb + ' As ' + SIDE[side] + '</button>';
    return '<div class="auth-sides">' + button('buyer') + button('seller') + '</div>';
  }

  function pressed(e) {
    const b = e.submitter;
    return b && b.value === 'seller' ? 'seller' : 'buyer';
  }

  function profileFields(p, prefix) {
    const id = name => prefix + name;
    const countries = T7.catalog.countries.map(c =>
      '<option' + ((p.country || 'South Africa') === c ? ' selected' : '') + '>' + esc(c) + '</option>').join('');
    return '<div class="form-row">' +
             '<div class="field"><label for="' + id('first') + '">First name</label><input id="' + id('first') + '" name="first_name" type="text" autocomplete="given-name" value="' + esc(p.first_name || '') + '" required><p class="field-error"></p></div>' +
             '<div class="field"><label for="' + id('last') + '">Surname</label><input id="' + id('last') + '" name="last_name" type="text" autocomplete="family-name" value="' + esc(p.last_name || '') + '" required><p class="field-error"></p></div>' +
           '</div>' +
           '<div class="form-row">' +
             '<div class="field"><label for="' + id('phone') + '">Phone</label><input id="' + id('phone') + '" name="phone" type="tel" autocomplete="tel" placeholder="+27 82 000 0000" value="' + esc(p.phone || '') + '" required><p class="field-error"></p></div>' +
             '<div class="field"><label for="' + id('country') + '">Country</label><select id="' + id('country') + '" name="country" autocomplete="country-name">' + countries + '</select></div>' +
           '</div>' +
           '<div class="field">' +
             '<label for="' + id('company') + '">Company or trading name <span class="opt">(optional)</span></label>' +
             '<input id="' + id('company') + '" name="company" type="text" autocomplete="organization" value="' + esc(p.company || '') + '">' +
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

  function profileValues(form, side) {
    return {
      role: side,
      first_name: form.elements.first_name.value.trim(),
      last_name: form.elements.last_name.value.trim(),
      phone: form.elements.phone.value.trim(),
      country: form.elements.country.value,
      company: form.elements.company.value.trim()
    };
  }

  /* ---------- The main screen: Sign In / Create Account tabs ----------
     One card. Only the Sign In form shows until "Create Account" is
     pressed; each form has its own Buyer and Seller buttons. */
  function authPanels(message, tab) {
    layout(false);
    let current = tab || startAt;
    root.innerHTML =
      (message ? '<div class="notice auth-message">' + message + '</div>' : '') +
      '<div class="auth-card">' +
        '<div class="auth-tabs" role="tablist" aria-label="Sign in or create an account">' +
          '<button type="button" role="tab" id="tab-signin" aria-controls="signin-card">Sign In</button>' +
          '<button type="button" role="tab" id="tab-signup" aria-controls="signup-card">Create Account</button>' +
        '</div>' +

        '<section id="signin-card" role="tabpanel" aria-labelledby="tab-signin">' +
          (GOOGLE ? '<button type="button" class="btn-google" id="google"><span>Continue with Google</span></button><div class="auth-divider"><span>or use your email</span></div>' : '') +
          '<form class="form" id="signin-form" novalidate>' +
            '<div class="field"><label for="si-email">Email</label><input id="si-email" name="email" type="email" autocomplete="username" required><p class="field-error"></p></div>' +
            passwordField('si-password', 'Password', 'current-password') +
            '<p class="form-error" role="alert" hidden></p>' +
            sideButtons('Sign In') +
          '</form>' +
          '<p class="auth-foot"><button type="button" class="linklike" id="forgot">Forgot your password?</button>' +
          '<span>New here? <button type="button" class="linklike" data-tab="signup">Create an account</button></span></p>' +
        '</section>' +

        '<section id="signup-card" role="tabpanel" aria-labelledby="tab-signup">' +
          '<div class="auth-kind" role="group" aria-label="Create an account to buy or to sell">' +
            '<button type="button" data-kind="buyer" aria-pressed="false">Sign Up As Buyer</button>' +
            '<button type="button" data-kind="seller" aria-pressed="false">Sign Up As Seller</button>' +
          '</div>' +
          '<p class="auth-card-sub" id="kind-sub"></p>' +
          '<form class="form" id="signup-form" novalidate>' +
            '<div id="seller-fields">' + profileFields({}, 'su-') + '</div>' +
            '<div class="field"><label for="su-email">Email</label><input id="su-email" name="email" type="email" autocomplete="email" required><p class="field-error"></p></div>' +
            passwordField('su-password', 'Password', 'new-password', 'At least 8 characters.') +
            '<p class="form-error" role="alert" hidden></p>' +
            '<button type="submit" class="btn-desk auth-submit" id="signup-submit"></button>' +
            '<p class="field-hint auth-center">We will email you a link to confirm your address.</p>' +
          '</form>' +
          '<p class="auth-foot"><span>Already have an account? <button type="button" class="linklike" data-tab="signin">Sign in</button></span></p>' +
        '</section>' +
      '</div>';

    function show(which, focus) {
      current = which;
      const up = which === 'signup';
      document.getElementById('signin-card').hidden = up;
      document.getElementById('signup-card').hidden = !up;
      [['tab-signin', !up], ['tab-signup', up]].forEach(([id, on]) => {
        const t = document.getElementById(id);
        t.classList.toggle('is-on', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      head(up ? 'Create Account' : (wantedAs ? 'Sign In As ' + SIDE[wantedAs] : 'Sign In'),
        up ? 'One account to buy and sell on the Trade Desk.' : 'Buy and sell with one account.');
      /* Keep the address in step so Back and a refresh land on the same tab. */
      try {
        const u = new URL(location.href);
        if (up) u.searchParams.set('mode', 'signup'); else u.searchParams.delete('mode');
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) {}
      if (focus) document.getElementById(up ? (document.getElementById('signup-form').dataset.kind === 'seller' ? 'su-first' : 'su-email') : 'si-email').focus();
    }

    document.getElementById('tab-signin').addEventListener('click', () => show('signin', true));
    document.getElementById('tab-signup').addEventListener('click', () => show('signup', true));
    root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => show(b.dataset.tab, true)));
    root.querySelector('.auth-tabs').addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      show(current === 'signin' ? 'signup' : 'signin', false);
      document.getElementById(current === 'signin' ? 'tab-signin' : 'tab-signup').focus();
    });

    wireSignin(document.getElementById('signin-form'));
    wireSignup(document.getElementById('signup-form'));
    const g = document.getElementById('google');
    if (g) g.addEventListener('click', async () => {
      g.disabled = true;
      try { await T7.auth.signInWithGoogle(leaning, next); }
      catch (err) { g.disabled = false; formError(document.getElementById('signin-form'), err.message); }
    });
    document.getElementById('forgot').addEventListener('click', () =>
      forgotForm(document.getElementById('si-email').value.trim()));

    /* Buyer or seller inside the Create Account tab. A buyer needs only
       an email and a password; a seller also gives a name and phone
       number so buyers and the desk know who they are dealing with. */
    const form = document.getElementById('signup-form');
    function kind(which, focus) {
      form.dataset.kind = which;
      const selling = which === 'seller';
      root.querySelectorAll('[data-kind]').forEach(b => {
        const on = b.dataset.kind === which;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      const extra = document.getElementById('seller-fields');
      extra.hidden = !selling;
      extra.querySelectorAll('input, select').forEach(el => { el.disabled = !selling; });
      document.getElementById('kind-sub').textContent = selling
        ? 'Sellers list lots for the desk to approve. Buyers see your name and number on enquiries, so we need them.'
        : 'All a buyer needs is an email and a password. You can add selling to the same account later.';
      const btn = document.getElementById('signup-submit');
      btn.textContent = selling ? 'Create Seller Account' : 'Create Buyer Account';
      btn.dataset.label = btn.textContent;
      btn.classList.toggle('is-seller', selling);
      formError(form, '');
      form.querySelectorAll('.is-invalid').forEach(f => { f.classList.remove('is-invalid'); const er = f.querySelector('.field-error'); if (er) er.textContent = ''; });
      if (focus) document.getElementById(selling ? 'su-first' : 'su-email').focus();
    }
    root.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => kind(b.dataset.kind, true)));
    kind(leaning, false);

    show(current, false);
  }

  function wireSignin(form) {
    clearOnInput(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const side = pressed(e);
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { setError(form, 'email', 'Enter your email address.'); form.elements.email.focus(); return; }
      if (!password) { setError(form, 'password', 'Enter your password.'); form.elements.password.focus(); return; }

      const btn = e.submitter || form.querySelector('button[type=submit]');
      lock(form, true);
      busy(btn, 'Signing in…');
      try {
        const profile = await T7.auth.signIn(email, password);
        if (!profile) throw new Error('We could not load your account. Please try again.');
        route(profile, side);
      } catch (err) {
        busy(btn, '');
        lock(form, false);
        if (/confirm your email/i.test(err.message)) return verifySent(email, true);
        formError(form, err.message);
      }
    });
  }

  function wireSignup(form) {
    clearOnInput(form);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const side = form.dataset.kind === 'seller' ? 'seller' : 'buyer';
      if (side === 'seller' && !validateProfile(form)) return;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      if (!EMAIL.test(email)) { setError(form, 'email', 'That email address does not look right.'); form.elements.email.focus(); return; }
      if (password.length < 8) { setError(form, 'password', 'Use at least 8 characters.'); form.elements.password.focus(); return; }

      const btn = e.submitter || form.querySelector('button[type=submit]');
      lock(form, true);
      busy(btn, 'Creating your account…');
      try {
        const fields = side === 'seller' ? profileValues(form, side) : { role: 'buyer' };
        const result = await T7.auth.signUp(Object.assign(fields, { email: email, password: password }), next);
        if (result.needsVerification) verifySent(email, false, result.devLink);
        else route(result.profile, side);
      } catch (err) {
        busy(btn, '');
        lock(form, false);
        formError(form, err.message);
      }
    });
  }

  /* ---------- Signed in, but this account does not have that side yet ---------- */
  /* A seller needs a name and phone number. An account that signed up
     as a buyer with just an email gives them here, once. */
  function needsSellerDetails(profile) {
    return !(profile.first_name && profile.last_name && profile.phone);
  }

  function addSide(profile, side) {
    const other = side === 'seller' ? 'buyer' : 'seller';
    const askDetails = side === 'seller' && needsSellerDetails(profile);
    head(side === 'seller' ? 'Start Selling' : 'Start Buying', 'Use the same account for both.');
    single(
      '<h2 class="auth-card-title">' + (side === 'seller' ? 'Sell with this account?' : 'Buy with this account?') + '</h2>' +
      '<p class="auth-card-sub"><strong>' + esc(profile.email) + '</strong> is set up for ' + DOING[other] + '. ' +
        'Add ' + DOING[side] + ' to the same account: same email, same password, nothing new to remember. ' +
        (side === 'seller' ? 'Lots you list are checked by the desk before buyers see them.' : 'You can then send enquiries to sellers.') +
        (askDetails ? ' Sellers also give a name and phone number, so buyers and the desk know who they are dealing with.' : '') + '</p>' +
      '<form class="form" id="add-side-form" novalidate>' +
        (askDetails ? profileFields(profile, 'as-') : '') +
        '<p class="form-error" role="alert" hidden></p>' +
        '<div class="auth-sides">' +
          '<button type="submit" class="btn-desk' + (side === 'seller' ? ' is-seller' : '') + '" id="add-side">Yes, Add ' + (side === 'seller' ? 'Selling' : 'Buying') + '</button>' +
          '<button type="button" class="btn-line" id="keep-side">Continue As ' + SIDE[other] + '</button>' +
        '</div>' +
      '</form>' +
      '<p class="auth-foot"><button type="button" class="linklike" id="signout">Sign out</button></p>');

    const form = document.getElementById('add-side-form');
    clearOnInput(form);
    document.getElementById('keep-side').addEventListener('click', () => go(T7.auth.setMode(other)));
    document.getElementById('signout').addEventListener('click', async () => { await T7.auth.signOut(); authPanels(); });
    const btn = document.getElementById('add-side');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (askDetails && !validateProfile(form)) return;
      busy(btn, 'Adding…');
      try {
        const updated = askDetails
          ? await T7.auth.completeProfile(profileValues(form, side))
          : await T7.auth.enableRole(side);
        T7.toast(side === 'seller' ? 'Selling added to your account' : 'Buying added to your account');
        go(updated);
      } catch (err) {
        busy(btn, '');
        formError(form, err.message);
      }
    });
  }

  /* ---------- Other screens ---------- */
  async function notConnected() {
    head('Sign In', 'The Trade Desk needs its database before anyone can sign in.');
    /* If the server is up but MySQL is not, it says exactly why. */
    let reason = '';
    try { const r = await fetch('/api/ping'); if (r.status === 503) reason = (await r.json()).error || ''; } catch (e) {}
    single(
      '<div class="notice">' +
        '<strong>The database is not connected.</strong> ' +
        (reason ? esc(reason)
                : 'Start the site with <code>node serve.js</code> and open <code>http://localhost:4180</code>. See <code>SETUP.md</code>.') +
      '</div>');
  }

  function verifySent(email, wasSigningIn, devLink) {
    head('Check Your Inbox', 'One click on the link we sent and you are in.');
    single(
      '<div class="auth-state">' +
        '<h2>Confirm your email</h2>' +
        '<p>' + (wasSigningIn ? 'This account has not been confirmed yet. ' : '') +
          'We sent a link to <strong>' + esc(email) + '</strong>. Open it on this device to finish signing in. ' +
          'It can take a minute to arrive — check your spam folder too.</p>' +
        '<div class="notice" id="dev-link" style="margin-bottom:22px"' + (devLink ? '' : ' hidden') + '>' +
          '<strong>Running on your own computer: no real email is sent.</strong> The link is also printed in the terminal. ' +
          '<a class="textlink" id="dev-link-a" href="' + esc(devLink || '#') + '">Open the confirmation link</a></div>' +
        '<p class="form-error" role="alert" hidden></p>' +
        '<div class="action-row">' +
          '<button type="button" class="btn-desk" id="resend">Send It Again</button>' +
          '<button type="button" class="btn-line" id="back">Back To Sign In</button>' +
        '</div>' +
      '</div>');
    const card = root.querySelector('.auth-card');
    document.getElementById('back').addEventListener('click', () => authPanels());
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
        formError(card, err.message);
      }
    });
  }

  function forgotForm(prefill) {
    head('Reset Password', 'We will email you a link to choose a new one.');
    single(
      '<h2 class="auth-card-title">Reset your password</h2>' +
      '<form class="form" id="forgot-form" novalidate>' +
        '<div class="field"><label for="fp-email">Email</label><input id="fp-email" name="email" type="email" autocomplete="username" value="' + esc(prefill || '') + '" required><p class="field-error"></p></div>' +
        '<p class="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Email Me A Reset Link</button>' +
      '</form>' +
      '<p class="auth-foot"><button type="button" class="linklike" id="to-signin">Back to sign in</button></p>');
    const form = document.getElementById('forgot-form');
    clearOnInput(form);
    document.getElementById('to-signin').addEventListener('click', () => authPanels('', 'signin'));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = form.elements.email.value.trim();
      if (!EMAIL.test(email)) { setError(form, 'email', 'Enter your email address.'); return; }
      const btn = form.querySelector('.auth-submit');
      busy(btn, 'Sending…');
      try {
        await T7.auth.sendPasswordReset(email);
        authPanels('<strong>Check your inbox.</strong> If ' + esc(email) + ' has an account, a reset link is on its way.', 'signin');
      } catch (err) {
        busy(btn, '');
        formError(form, err.message);
      }
    });
  }

  function newPasswordForm(profile) {
    head('New Password', 'Choose a new password for ' + (profile.email || 'your account') + '.');
    single(
      '<h2 class="auth-card-title">Choose a new password</h2>' +
      '<form class="form" id="password-form" novalidate>' +
        passwordField('np-password', 'New password', 'new-password', 'At least 8 characters.') +
        '<p class="form-error" role="alert" hidden></p>' +
        '<button type="submit" class="btn-desk auth-submit">Save And Continue</button>' +
      '</form>');
    const form = document.getElementById('password-form');
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
        formError(form, err.message);
      }
    });
  }

  /* Signed in but neither buying nor selling yet (a first Google
     sign-in): ask once, with the same pair of buttons. */
  function finishProfile(profile, side) {
    head('Almost There', 'A few details, then choose how you will use the Trade Desk.');
    single(
      '<h2 class="auth-card-title">Finish your account</h2>' +
      '<form class="form" id="finish-form" novalidate>' +
        profileFields(profile, 'fp-') +
        '<p class="form-error" role="alert" hidden></p>' +
        sideButtons('Continue') +
      '</form>' +
      '<p class="auth-foot"><span>Signed in as ' + esc(profile.email) + '. <button type="button" class="linklike" id="signout">Sign out</button></span></p>');
    const form = document.getElementById('finish-form');
    clearOnInput(form);
    document.getElementById('signout').addEventListener('click', async () => { await T7.auth.signOut(); authPanels(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const chosen = e.submitter ? pressed(e) : (side || T7.auth.pendingRole() || 'buyer');
      if (!validateProfile(form)) return;
      const btn = e.submitter || form.querySelector('button[type=submit]');
      lock(form, true);
      busy(btn, 'Saving…');
      try {
        const updated = await T7.auth.completeProfile(profileValues(form, chosen));
        route(updated, chosen);
      } catch (err) {
        busy(btn, '');
        lock(form, false);
        formError(form, err.message);
      }
    });
  }

  function suspended(profile) {
    head('Account On Hold', 'This account cannot use the Trade Desk at the moment.');
    single(
      '<div class="auth-state">' +
        '<h2>Your account is on hold</h2>' +
        '<p>' + esc(profile.email) + ' has been paused by the desk. Please ' +
          '<a class="textlink" href="contact.html">contact us</a> if you think this is a mistake.</p>' +
        '<div class="action-row"><button type="button" class="btn-line" id="signout">Sign Out</button></div>' +
      '</div>');
    document.getElementById('signout').addEventListener('click', async () => { await T7.auth.signOut(); authPanels(); });
  }

  /* ---------- Boot ---------- */
  (async function boot() {
    if (!(await T7.backendReady())) return notConnected();

    layout(false);
    root.innerHTML = '<p class="auth-wait">One moment…</p>';

    if (params.get('signout')) {
      await T7.auth.signOut();
      history.replaceState(null, '', location.pathname);
      T7.toast('Signed out');
      return authPanels();
    }

    let profile = null;
    try {
      profile = await T7.auth.ready();
    } catch (e) {
      console.error(e);
    }

    if (profile && isRecovery) return newPasswordForm(profile);
    if (profile) return route(profile, wantedAs);

    if (linkError) {
      history.replaceState(null, '', location.pathname + location.search);
      return authPanels('<strong>That link did not work.</strong> ' + esc(linkError.replace(/\+/g, ' ')) +
        '. Sign in below, or ask for a new link.');
    }
    authPanels(wantedAs ? 'Sign in to continue as a <strong>' + wantedAs + '</strong>.' : '');
  })();
})();
