/* ============================================================
   Triple 7 Holdings — accounts
   ------------------------------------------------------------
   Real sign-in. Passwords are checked by the database server, never
   by this file, and what each account may read or change is enforced
   there too: Supabase online (supabase/01_schema.sql), or the local
   database on your own computer (local-db/server.js).

   Three kinds of account:
     buyer   browses the board and sends enquiries
     seller  lists lots and answers enquiries
     admin   reviews everything from the dashboard

   An admin is not a different login. It is an ordinary account
   whose role was set to "admin" in the database, and it signs in on
   the same page as everyone else. See SETUP.md.

   The small copy of the session kept in localStorage ("t7.session")
   only decides what the menus show while the page loads. It grants
   nothing: edit it by hand and the database still refuses.
   ============================================================ */
window.T7 = window.T7 || {};

(function () {
  const cfg = window.T7_CONFIG || {};
  /* Two backends, same behaviour:
       supabase  js/config.js has a project URL and key (use this online)
       local     no keys: talk to the MySQL-backed API that `node serve.js`
                 runs on this computer (local-db/server.js)               */
  const useSupabase = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);
  const LOCAL = !useSupabase;
  const configured = true;
  const TOKEN_KEY = 't7.local-token';
  const CACHE_KEY = 't7.session';
  const PENDING_KEY = 't7.pending-signup';
  const MODE_KEY = 't7.mode';

  /* ---------- Buying or selling ----------
     One account can be a buyer, a seller, or both. Which side someone
     is using right now ("mode") is chosen by the button they signed in
     with, and can be switched from the Account menu. It only decides
     which screens they see; what they may do is checked by the database
     against the account itself. */
  function can(profile, mode) {
    if (!profile) return false;
    /* Older databases (before 9 Oct 2026) kept one role per account. */
    if (mode === 'buyer') return Boolean(profile.is_buyer) || profile.role === 'buyer';
    if (mode === 'seller') return Boolean(profile.is_seller) || profile.role === 'seller';
    return false;
  }

  function storedMode() { try { return localStorage.getItem(MODE_KEY); } catch (e) { return null; } }
  function storeMode(mode) { try { if (mode) localStorage.setItem(MODE_KEY, mode); else localStorage.removeItem(MODE_KEY); } catch (e) {} }

  /* The side this account is acting as: 'admin', 'buyer', 'seller', or
     null when it has neither yet. */
  function activeRole(profile) {
    if (profile.role === 'admin') return 'admin';
    const wanted = storedMode();
    if (wanted && can(profile, wanted)) return wanted;
    if (can(profile, 'buyer')) return 'buyer';
    if (can(profile, 'seller')) return 'seller';
    return null;
  }

  let lastProfile = null;

  /* ---------- Cached session (for menus only) ---------- */
  function readCache() {
    try {
      const s = JSON.parse(localStorage.getItem(CACHE_KEY));
      return s && s.id ? s : null;
    } catch (e) { return null; }
  }

  function writeCache(profile) {
    lastProfile = profile || null;
    const next = profile ? {
      id: profile.id, email: profile.email, role: activeRole(profile), status: profile.status || 'active',
      is_buyer: can(profile, 'buyer'), is_seller: can(profile, 'seller'), is_admin: profile.role === 'admin',
      first_name: profile.first_name || '', last_name: profile.last_name || '',
      company: profile.company || '', phone: profile.phone || '', country: profile.country || ''
    } : null;
    try {
      if (next) localStorage.setItem(CACHE_KEY, JSON.stringify(next));
      else localStorage.removeItem(CACHE_KEY);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('t7:session', { detail: next }));
    return next;
  }

  /* ---------- Local database ---------- */
  function localToken() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
  function setLocalToken(t) { try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch (e) {} }

  T7.backend = LOCAL ? 'local' : 'supabase';

  /* One call to the local server: T7.local('listLots', {...}). */
  T7.local = async function (fn, args) {
    let res;
    try {
      res = await fetch('/api/rpc', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, localToken() ? { Authorization: 'Bearer ' + localToken() } : {}),
        body: JSON.stringify({ fn: fn, args: args || {} })
      });
    } catch (e) {
      throw new Error('The site\'s server is not running. Start it with: node serve.js');
    }
    const body = await res.json().catch(() => null);
    if (!body) throw new Error('The site\'s server is not running. Start it with: node serve.js');
    if (!res.ok) throw new Error(body.error || 'The request failed.');
    return body.data;
  };

  /* Is there a backend to talk to at all? */
  T7.backendReady = async function () {
    if (!LOCAL) return true;
    try { const r = await fetch('/api/ping'); return r.ok && (await r.json()).local === true; } catch (e) { return false; }
  };

  /* ---------- Supabase client ----------
     The library is loaded on demand so pages that never sign anyone
     in (the homepage, About, Mines …) do not download it. */
  let clientPromise = null;

  function loadLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/supabase.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('The sign-in library could not be loaded.'));
      document.head.appendChild(s);
    });
  }

  T7.client = function () {
    if (LOCAL) return Promise.resolve(null);
    if (!clientPromise) {
      clientPromise = loadLibrary().then(() =>
        window.supabase.createClient(cfg.supabaseUrl.replace(/^(https?:\/\/[^\/]+).*$/, '$1'), cfg.supabaseAnonKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        }));
    }
    return clientPromise;
  };

  /* ---------- Who is signed in ---------- */
  async function loadProfile(client, user) {
    const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    /* The profile row is created by a database trigger. If it is
       somehow missing, behave as "signed in, nothing chosen yet". */
    return data || { id: user.id, email: user.email, role: 'member', is_buyer: false, is_seller: false, status: 'active' };
  }

  async function resolveSession() {
    if (LOCAL) {
      /* Arriving from a confirmation link: the server passes the new
         session in the address, once. */
      const m = location.hash.match(/local_token=([a-f0-9]+)/);
      if (m) { setLocalToken(m[1]); history.replaceState(null, '', location.pathname + location.search); }
      if (!localToken()) { writeCache(null); return null; }
      try {
        const profile = await T7.local('me');
        if (!profile) setLocalToken(null);
        return writeCache(profile);
      } catch (e) {
        console.error(e);
        return readCache();
      }
    }
    const client = await T7.client();
    if (!client) { writeCache(null); return null; }
    const { data } = await client.auth.getSession();
    if (!data || !data.session) { writeCache(null); return null; }
    try {
      return writeCache(await loadProfile(client, data.session.user));
    } catch (e) {
      console.error(e);
      /* Offline or a hiccup: fall back to what we last knew rather
         than throwing a signed-in person out. */
      return readCache();
    }
  }

  let readyPromise = null;

  function friendly(error) {
    const msg = (error && error.message) || String(error || '');
    if (/invalid login credentials/i.test(msg)) return 'That email and password do not match an account.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link we sent.';
    if (/already registered|already been registered/i.test(msg)) return 'An account with that email already exists. Sign in instead.';
    if (/password should be at least|weak password/i.test(msg)) return 'Choose a longer password (at least 8 characters).';
    if (/rate limit|too many|security purposes/i.test(msg)) return 'Too many attempts. Please wait a minute and try again.';
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'We could not reach the server. Check your connection and try again.';
    if (/provider is not enabled|unsupported provider/i.test(msg)) return 'Google sign-in is not switched on yet. Use email and password for now.';
    return msg || 'Something went wrong. Please try again.';
  }

  function signinUrl(next) {
    const url = new URL('signin.html', location.href);
    url.search = next ? '?next=' + encodeURIComponent(next) : '';
    url.hash = '';
    return url.href;
  }

  T7.auth = {
    configured: configured,
    friendly: friendly,

    /* What the menus should show right now. Not a security check. */
    current: readCache,

    /* Resolves to the verified profile, or null when signed out. */
    ready() {
      if (!readyPromise) readyPromise = resolveSession();
      return readyPromise;
    },

    refresh() {
      readyPromise = resolveSession();
      return readyPromise;
    },

    /* Can this account buy / sell? */
    can(mode) { return can(lastProfile || readCache(), mode); },

    /* Switch between buying and selling (both must already be allowed). */
    setMode(mode) {
      storeMode(mode);
      return lastProfile ? writeCache(lastProfile) : readCache();
    },

    /* Give this account the other side as well, then switch to it. */
    async enableRole(mode) {
      if (LOCAL) await T7.local('enableRole', { role: mode });
      else {
        const client = await T7.client();
        const { error } = await client.rpc('enable_role', { p_role: mode });
        if (error) throw new Error(friendly(error));
      }
      storeMode(mode);
      return T7.auth.refresh();
    },

    homeFor(role) {
      if (role === 'admin') return 'admin.html';
      if (role === 'seller') return 'seller.html';
      return 'trade.html';
    },

    /* The address that switches to buying or selling (and, if this account
       does not have that side yet, offers to add it). */
    switchUrl(mode) { return 'signin.html?as=' + mode; },

    displayName(profile) {
      const p = profile || readCache();
      if (!p) return '';
      return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.company || p.email || '';
    },

    async signIn(email, password) {
      if (LOCAL) {
        const result = await T7.local('signIn', { email: email, password: password });
        setLocalToken(result.token);
        return T7.auth.refresh();
      }
      const client = await T7.client();
      if (!client) throw new Error('The database is not connected yet.');
      const { error } = await client.auth.signInWithPassword({ email: email, password: password });
      if (error) throw new Error(friendly(error));
      return T7.auth.refresh();
    },

    /* Returns { profile } when the account is usable straight away, or
       { needsVerification: true } when a confirmation email was sent. */
    async signUp(fields, next) {
      storeMode(fields.role === 'seller' ? 'seller' : 'buyer');
      if (LOCAL) return T7.local('signUp', Object.assign({}, fields, { next: next || '' }));
      const client = await T7.client();
      if (!client) throw new Error('The database is not connected yet.');
      const { data, error } = await client.auth.signUp({
        email: fields.email,
        password: fields.password,
        options: {
          emailRedirectTo: signinUrl(next),
          data: {
            role: fields.role === 'seller' ? 'seller' : 'buyer',
            first_name: fields.first_name, last_name: fields.last_name,
            phone: fields.phone || '', country: fields.country || '', company: fields.company || ''
          }
        }
      });
      if (error) throw new Error(friendly(error));
      /* Supabase answers a repeat sign-up with a blank user so nobody can
         use the form to test which emails have accounts. */
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error('An account with that email already exists. Sign in with it as a ' +
          (fields.role === 'seller' ? 'seller' : 'buyer') + ' instead; the same account can buy and sell.');
      }
      if (!data.session) return { needsVerification: true };
      return { profile: await T7.auth.refresh() };
    },

    async resendVerification(email, next) {
      if (LOCAL) return T7.local('resend', { email: email, next: next || '' });
      const client = await T7.client();
      const { error } = await client.auth.resend({ type: 'signup', email: email, options: { emailRedirectTo: signinUrl(next) } });
      if (error) throw new Error(friendly(error));
    },

    /* Leaves the site for Google and comes back to signin.html. The
       buyer/seller choice cannot travel through Google, so it is kept
       here and applied when the visitor returns. */
    async signInWithGoogle(role, next) {
      if (LOCAL) throw new Error('Google sign-in needs the online database (Supabase). Here, use email and password.');
      const client = await T7.client();
      if (!client) throw new Error('The database is not connected yet.');
      try { localStorage.setItem(PENDING_KEY, JSON.stringify({ role: role || null })); } catch (e) {}
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: signinUrl(next) } });
      if (error) throw new Error(friendly(error));
    },

    pendingRole() {
      try { return (JSON.parse(localStorage.getItem(PENDING_KEY)) || {}).role || null; } catch (e) { return null; }
    },

    async completeProfile(fields) {
      if (LOCAL) { await T7.local('completeProfile', fields); if (fields.role) storeMode(fields.role); return T7.auth.refresh(); }
      const client = await T7.client();
      const { error } = await client.rpc('complete_profile', {
        p_role: fields.role || null,
        p_first_name: fields.first_name || '', p_last_name: fields.last_name || '',
        p_phone: fields.phone || null, p_country: fields.country || null, p_company: fields.company || null
      });
      if (error) throw new Error(friendly(error));
      try { localStorage.removeItem(PENDING_KEY); } catch (e) {}
      if (fields.role) storeMode(fields.role);
      return T7.auth.refresh();
    },

    async sendPasswordReset(email) {
      if (LOCAL) throw new Error('No emails are sent from your own computer. Reset it in the terminal: node local-db/admin.js password ' + email + ' NewPassword123');
      const client = await T7.client();
      if (!client) throw new Error('The database is not connected yet.');
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: signinUrl() });
      if (error) throw new Error(friendly(error));
    },

    async setPassword(password) {
      const client = await T7.client();
      const { error } = await client.auth.updateUser({ password: password });
      if (error) throw new Error(friendly(error));
    },

    async signOut() {
      if (LOCAL) {
        try { if (localToken()) await T7.local('signOut'); } catch (e) { console.error(e); }
        setLocalToken(null);
        storeMode(null);
        writeCache(null);
        readyPromise = Promise.resolve(null);
        return;
      }
      try {
        const client = await T7.client();
        if (client) await client.auth.signOut();
      } catch (e) { console.error(e); }
      storeMode(null);
      writeCache(null);
      readyPromise = Promise.resolve(null);
    },

    /* Page guard. Sends the visitor to sign in (and back again), or to
       their own home if this page is not for their kind of account.
       Resolves to the profile, or null if a redirect is under way.

       This keeps people on the right screens. It is the database, not
       this function, that keeps data private. */
    async require(roles) {
      const profile = await T7.auth.ready();
      const here = location.pathname.split('/').pop() + location.search + location.hash;
      if (!profile) {
        location.replace('signin.html?next=' + encodeURIComponent(here));
        return null;
      }
      if (profile.status === 'suspended' || !profile.role) {
        location.replace('signin.html');
        return null;
      }
      if (roles && roles.length && roles.indexOf(profile.role) === -1) {
        /* A page for the other side of the same account (the seller
           dashboard while buying, say): just switch sides. */
        const other = roles.find(r => r !== 'admin' && T7.auth.can(r));
        if (other && profile.role !== 'admin') return T7.auth.setMode(other);
        location.replace(T7.auth.homeFor(profile.role));
        return null;
      }
      return profile;
    }
  };

  /* The slim account area on the right of the Trade Desk strip
     (lot, seller pages). Same rule as the menus: display only. */
  function paintStrip() {
    let el = document.getElementById('strip-account');
    if (!el) {
      /* Guide pages (How to Buy, Origin & Documentation) carry the same
         strip without an account area written in; add it so the strip is
         the same everywhere. */
      const strip = document.querySelector('.market-strip:not(.admin-tabs) .market-strip-inner');
      if (!strip) return;
      el = document.createElement('div');
      el.className = 'market-accounts';
      el.id = 'strip-account';
      strip.appendChild(el);
    }
    const s = readCache();
    if (!s || !s.role) { el.innerHTML = '<a href="signin.html">Sign in</a>'; return; }
    const home = s.role === 'admin' ? '<a href="admin.html">Dashboard</a>'
               : s.role === 'seller' ? '<a href="seller.html">My dashboard</a>' : '';
    const other = s.role === 'buyer' ? 'seller' : s.role === 'seller' ? 'buyer' : null;
    const swap = other ? '<a href="' + T7.auth.switchUrl(other) + '">' + (other === 'seller' ? 'Sell' : 'Buy') + '</a>' : '';
    el.innerHTML = '<span>' + T7.auth.displayName(s).replace(/[&<>"]/g, '') + ' · ' + (s.role === 'admin' ? 'Admin' : s.role === 'seller' ? 'Selling' : 'Buying') + '</span>' +
                   home + swap + '<a href="signin.html?signout=1">Sign out</a>';
  }
  document.addEventListener('t7:session', paintStrip);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintStrip);
  else paintStrip();

  /* Another tab signed in or out: repaint the menus here too. */
  window.addEventListener('storage', e => {
    if (e.key === CACHE_KEY) document.dispatchEvent(new CustomEvent('t7:session', { detail: readCache() }));
  });
})();
