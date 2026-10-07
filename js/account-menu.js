(function () {
 function init() {
  const menu = document.querySelector('.account-menu');
  if (!menu) return;
  // Reuse the existing session-aware link; authentication behaviour remains owned by auth.js.
  const session = document.querySelector('.nav-session');
  if (session) {
   const fallback = menu.querySelector('.account-signin');
   if (fallback) fallback.replaceWith(session);
  }
  document.addEventListener('click', e => { if (!menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', e => {
   if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
  });
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
 else init();
})();
