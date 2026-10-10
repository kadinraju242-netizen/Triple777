/* ============================================================
   Triple 7 Holdings — the Account menu in the top navigation
   ------------------------------------------------------------
   Loaded on every page. The menu's links are written into each
   page for visitors without JavaScript; here they are swapped for
   links that match who is signed in.

   It reads the small session copy that js/auth.js keeps in
   localStorage, so it works on pages that do not load the sign-in
   library at all. That copy only decides which links to show —
   the pages behind them check the real session.
   ============================================================ */
(function () {
  function session() {
    try {
      const s = JSON.parse(localStorage.getItem('t7.session'));
      return s && s.id ? s : null;
    } catch (e) { return null; }
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* For an admin, the Trade link in the top navigation opens the
     dashboard; the board itself is reached from a button there. */
  function repointTrade() {
    const s = session();
    /* An admin may look at the board only by pressing "View Trade Board"
       on the dashboard, which sets a pass for this browser tab. Any page
       other than the board or a lot takes the pass away again. */
    try {
      if (!/(^|\/)(trade|lot)(\.html)?\/?$/i.test(location.pathname)) sessionStorage.removeItem('t7.admin-trade');
    } catch (e) {}
    document.querySelectorAll('.nav-links a[href="trade.html"], .nav-links a[href="admin.html"]').forEach(a => {
      a.setAttribute('href', s && s.role === 'admin' ? 'admin.html' : 'trade.html');
    });
  }

  function paint() {
    if (document.body.classList.contains("investor-portal")) return;
    const utility = document.querySelector('.nav-utility');
    if (utility) {
      repointTrade();
      const s = session();
      const signin = utility.querySelector('[data-nav-signin]');
      const register = utility.querySelector('[data-nav-register]');
      if (signin && register) {
        signin.textContent = s ? 'Dashboard' : 'Sign In';
        signin.href = s ? (s.role === 'admin' ? 'admin.html' : s.role === 'seller' ? 'seller.html' : 'buyer.html') : 'signin.html';
        register.textContent = s ? 'Sign Out' : 'Register';
        register.href = s ? 'signin.html?signout=1' : 'signin.html?mode=signup';
      }
      return;
    }
    const menu = document.querySelector('.account-menu');
    if (!menu) { repointTrade(); return; }
    const box = menu.querySelector('.account-dropdown');
    const summary = menu.querySelector('summary');
    if (!box || !summary) return;

    const s = session();
    repointTrade();
    if (!s || !s.role) {
      summary.textContent = 'Account';
      box.innerHTML =
        '<a href="investor-login.html">Investor login</a>' +
        '<a href="signin.html">Trade sign in</a>' +
        '<a href="signin.html?mode=signup">Create account</a>';
      return;
    }

    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.email;
    summary.textContent = s.first_name || 'Account';

    const links = ['<a href="investor-login.html">Investor portal</a>'];
    if (s.role === 'admin')  links.push('<a href="admin.html">Dashboard</a>');
    if (s.role === 'seller') links.push('<a href="seller.html">Seller dashboard</a>');
    if (s.role !== 'admin') links.push('<a href="trade.html">Browse lots</a>');
    /* One account can buy and sell: offer the other side. If this
       account does not have it yet, signin.html offers to add it. */
    if (s.role === 'buyer')  links.push('<a href="signin.html?as=seller">' + (s.is_seller ? 'Switch to selling' : 'Start selling') + '</a>');
    if (s.role === 'seller') links.push('<a href="signin.html?as=buyer">' + (s.is_buyer ? 'Switch to buying' : 'Start buying') + '</a>');
    links.push('<a href="signin.html?signout=1">Sign out</a>');

    box.innerHTML =
      '<div style="padding:10px 12px 12px;border-bottom:1px solid #e3e8f0;margin-bottom:6px;line-height:1.45">' +
        '<div style="font-size:14px;font-weight:700;overflow-wrap:anywhere">' + esc(name) + '</div>' +
        '<div style="font-size:12px;font-weight:600;opacity:.7">' + esc(s.role === 'admin' ? 'Admin account' : s.role === 'seller' ? 'Selling' + (s.is_buyer ? ' · also buys' : '') : 'Buying' + (s.is_seller ? ' · also sells' : '')) + '</div>' +
      '</div>' + links.join('');
  }

  function init() {
    const menu = document.querySelector('.account-menu');
    paint();
    if (!menu) return;
    document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
  }

  document.addEventListener('t7:session', paint);
  window.addEventListener('storage', e => { if (e.key === 't7.session') paint(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
