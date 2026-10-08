/* ============================================================
   Triple 7 Holdings — the Trade Desk board
   ------------------------------------------------------------
   Members only: signed-out visitors are sent to sign in and come
   straight back here.

   Built for few clicks:
     1 click  pick a category (the row of buttons)
     1 click  open a lot
     1 click  send the enquiry (the message is pre-written)

   Filters are BUILT FROM THE DATA, so the board never offers a
   filter that returns nothing. Pick a category and the filters
   that make sense for it appear (cut, colour and clarity for
   diamonds; purity for gold; and so on — see js/catalog.js).

   Filter state lives in the query string, so a refined board is a
   link that can be shared.
   ============================================================ */
(function () {
  const controls  = document.getElementById('controls');
  const filterRow = document.getElementById('filter-row');
  const board     = document.getElementById('board');
  const countEl   = document.getElementById('board-count');
  const sortEl    = document.getElementById('sort');
  const searchEl  = document.getElementById('q');
  const resetBtn  = document.getElementById('reset');
  const toggle    = document.getElementById('filters-toggle');
  const tabsEl    = document.getElementById('commodity-tabs');
  const welcomeEl = document.getElementById('trade-welcome');
  const mineEl    = document.getElementById('my-enquiries');
  if (!board) return;

  const cat = T7.catalog;
  const esc = T7.esc;

  let lots = [];
  let state = { sort: 'newest', f: {} };

  /* ---------- URL <-> state ---------- */
  function readUrl() {
    const q = new URLSearchParams(location.search);
    const next = { sort: q.get('sort') || 'newest', f: {} };
    const c = q.get('commodity');
    if (c && cat.get(c)) next.commodity = c;
    if (q.get('q')) next.q = q.get('q');
    if (q.get('min')) next.min = q.get('min');
    if (q.get('max')) next.max = q.get('max');
    q.forEach((value, key) => {
      if (key.indexOf('f.') === 0 && value) next.f[key.slice(2)] = value.split('|').filter(Boolean);
    });
    return next;
  }

  function writeUrl() {
    const q = new URLSearchParams();
    if (state.commodity) q.set('commodity', state.commodity);
    if (state.q) q.set('q', state.q);
    if (state.min) q.set('min', state.min);
    if (state.max) q.set('max', state.max);
    Object.keys(state.f).forEach(k => { if (state.f[k].length) q.set('f.' + k, state.f[k].join('|')); });
    if (state.sort && state.sort !== 'newest') q.set('sort', state.sort);
    const qs = q.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    resetBtn.hidden = !qs;
  }

  /* ---------- Category buttons ---------- */
  function paintTabs() {
    const counts = {};
    lots.forEach(l => { counts[l.commodity] = (counts[l.commodity] || 0) + 1; });
    const btn = (key, label, n) =>
      '<button type="button" data-commodity="' + key + '" aria-pressed="' + ((state.commodity || '') === key) + '">' +
        esc(label) + ' <span>' + n + '</span></button>';
    tabsEl.innerHTML = btn('', 'All Lots', lots.length) +
      cat.order.map(key => btn(key, cat.get(key).plural, counts[key] || 0)).join('');
  }

  /* ---------- Filters ---------- */
  /* A filter is either a column on the lot ("type", "origin") or one of
     the per-commodity details kept in lot.specs. */
  function facetList() {
    const list = [{ key: 'type', label: state.commodity ? cat.get(state.commodity).typeLabel : 'Type', get: l => l.type }];
    if (state.commodity) {
      cat.get(state.commodity).fields.forEach(f => {
        list.push({ key: f.key, label: f.label, order: f.options, get: l => (l.specs || {})[f.key] });
      });
    }
    list.push({ key: 'origin', label: 'Origin', get: l => l.origin });
    return list;
  }

  const inCategory = () => lots.filter(l => !state.commodity || l.commodity === state.commodity);

  function buildFilters() {
    const pool = inCategory();
    const parts = [];

    parts.push(
      '<fieldset class="filter-set"><legend>Price (rand)</legend><div class="range-row">' +
        '<input type="number" inputmode="numeric" min="0" step="1000" name="min" placeholder="Min" aria-label="Lowest price" value="' + esc(state.min || '') + '">' +
        '<input type="number" inputmode="numeric" min="0" step="1000" name="max" placeholder="Max" aria-label="Highest price" value="' + esc(state.max || '') + '">' +
      '</div></fieldset>');

    facetList().forEach(facet => {
      const seen = [];
      pool.forEach(l => { const v = facet.get(l); if (v && seen.indexOf(v) === -1) seen.push(v); });
      /* One option filters nothing. Don't show a control that cannot
         change the result. */
      if (seen.length < 2) { delete state.f[facet.key]; return; }
      seen.sort((a, b) => {
        if (facet.order) {
          const ia = facet.order.indexOf(a), ib = facet.order.indexOf(b);
          if (ia !== -1 && ib !== -1) return ia - ib;
        }
        return String(a).localeCompare(String(b));
      });
      const picked = state.f[facet.key] || [];
      const chips = seen.map(v => {
        const on = picked.indexOf(v) !== -1;
        return '<label class="chip' + (on ? ' is-on' : '') + '">' +
                 '<input type="checkbox" name="' + esc(facet.key) + '" value="' + esc(v) + '"' + (on ? ' checked' : '') + '>' +
                 esc(v) + '</label>';
      }).join('');
      parts.push('<fieldset class="filter-set"><legend>' + esc(facet.label) + '</legend><div class="chips">' + chips + '</div></fieldset>');
    });

    filterRow.innerHTML = parts.join('');
  }

  /* ---------- Filtering ---------- */
  function apply() {
    const term = (state.q || '').trim().toLowerCase();
    const min = Number(state.min) || 0;
    const max = Number(state.max) || 0;
    const facets = facetList();

    const list = inCategory().filter(l => {
      const price = Number(l.price_zar);
      if (min && price < min) return false;
      if (max && price > max) return false;
      for (let i = 0; i < facets.length; i++) {
        const picked = state.f[facets[i].key];
        if (picked && picked.length && picked.indexOf(facets[i].get(l)) === -1) return false;
      }
      if (term) {
        const hay = [l.lot_id, l.name, cat.label(l.commodity), l.type, l.origin, l.description]
          .concat(Object.keys(l.specs || {}).map(k => l.specs[k]))
          .filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(term) === -1) return false;
      }
      return true;
    });

    const by = {
      'newest':      (a, b) => new Date(b.created_at) - new Date(a.created_at),
      'price-asc':   (a, b) => a.price_zar - b.price_zar,
      'price-desc':  (a, b) => b.price_zar - a.price_zar,
      'weight-desc': (a, b) => (b.weight || 0) - (a.weight || 0),
      'lot':         (a, b) => a.lot_id.localeCompare(b.lot_id, undefined, { numeric: true })
    };
    list.sort(by[state.sort] || by.newest);

    tabsEl.querySelectorAll('[data-commodity]').forEach(b =>
      b.setAttribute('aria-pressed', String((state.commodity || '') === b.dataset.commodity)));
    render(list);
    writeUrl();
  }

  /* ---------- Render ---------- */
  function lotCard(l) {
    const href = 'lot.html?id=' + encodeURIComponent(l.lot_id);
    return '<article class="lot-card">' +
             '<a href="' + href + '" aria-hidden="true" tabindex="-1">' + T7.lotMedia(l, { card: true }) + '</a>' +
             '<div class="lot-card-body">' +
               '<div class="lot-meta">' +
                 '<span class="lot-id">' + esc(l.lot_id) + '</span>' +
                 '<span class="tag">' + esc(cat.label(l.commodity)) + '</span>' +
                 (l.latest ? '<span class="tag is-verified">New</span>' : '') +
               '</div>' +
               '<a class="lot-name textlink" href="' + href + '">' + esc(l.name) + '</a>' +
               '<p class="lot-desc">' + esc(cat.summary(l).join(' · ')) + '</p>' +
               '<div class="lot-foot">' +
                 '<span class="lot-price">' + esc(cat.money(l.price_zar)) + '</span>' +
                 '<a class="lot-open" href="' + href + '">View lot</a>' +
               '</div>' +
             '</div>' +
           '</article>';
  }

  function render(list) {
    const label = state.commodity ? cat.get(state.commodity).label.toLowerCase() + ' ' : '';
    countEl.textContent = list.length
      ? list.length + ' ' + label + (list.length === 1 ? 'lot' : 'lots')
      : 'No lots match';

    if (!list.length) {
      board.innerHTML =
        '<div class="empty">' +
          '<h3>' + (lots.length ? 'Nothing matches that' : 'No lots are listed yet') + '</h3>' +
          '<p>' + (lots.length
            ? 'Try another category or clear your filters. You can also tell the desk what you are looking for.'
            : 'New lots appear here as soon as the desk approves them.') + '</p>' +
          (lots.length ? '<button type="button" class="btn-desk" id="empty-reset">Clear Filters</button>'
                       : '<a href="contact.html" class="btn-desk">Contact The Desk</a>') +
        '</div>';
      const r = document.getElementById('empty-reset');
      if (r) r.addEventListener('click', reset);
      return;
    }
    board.innerHTML = '<div class="board-grid">' + list.map(lotCard).join('') + '</div>';
  }

  function reset() {
    state = { sort: 'newest', f: {} };
    sortEl.value = 'newest';
    searchEl.value = '';
    buildFilters();
    apply();
  }

  /* ---------- Who is here ---------- */
  function paintWelcome(profile) {
    const name = T7.auth.displayName(profile);
    const who = '<p><b>' + esc(name) + '</b>' + esc({ buyer: 'Buying', seller: 'Selling', admin: 'Admin, viewing the board' }[profile.role]) + '</p>';
    let action = '';
    if (profile.role === 'seller') action = '<a class="btn-desk" href="seller.html#new">List A Lot</a><a class="btn-line" href="seller.html">My Dashboard</a>';
    if (profile.role === 'buyer')  action = '<a class="btn-line" href="#my-enquiries" id="jump-enquiries" hidden>My Enquiries</a>';
    if (profile.role === 'admin')  action = '<a class="btn-desk" href="admin.html">Back To Dashboard</a>';
    /* The same account can switch sides, or add the side it lacks. */
    if (profile.role === 'buyer')  action += '<a class="btn-line" href="signin.html?as=seller">' + (profile.is_seller ? 'Switch To Selling' : 'Start Selling') + '</a>';
    if (profile.role === 'seller') action += '<a class="btn-line" href="signin.html?as=buyer">' + (profile.is_buyer ? 'Switch To Buying' : 'Start Buying') + '</a>';
    action += '<a class="btn-line" href="signin.html?signout=1">Sign Out</a>';
    welcomeEl.innerHTML = who + action;
  }

  async function paintMyEnquiries() {
    let rows;
    try { rows = await T7.api.myEnquiries(); } catch (e) { console.error(e); return; }
    if (!rows.length) return;
    const STATUS = { new: ['Sent', 'is-new'], answered: ['Seller replied', 'is-good'], closed: ['Closed', ''] };
    mineEl.hidden = false;
    mineEl.innerHTML =
      '<h2>Your enquiries <span class="muted">' + rows.length + '</span></h2>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Ref</th><th>Lot</th><th>Your message</th><th>Sent</th><th>Status</th></tr></thead><tbody>' +
      rows.map(r => {
        const s = STATUS[r.status] || [r.status, ''];
        const lot = r.lot
          ? '<a class="cell-main textlink" href="lot.html?id=' + encodeURIComponent(r.lot.lot_id) + '">' + esc(r.lot.name) + '</a><span class="muted">' + esc(r.lot.lot_id) + ' · ' + esc(cat.money(r.lot.price_zar)) + '</span>'
          : '<span class="muted">No longer on the board</span>';
        return '<tr><td class="muted">' + esc(r.ref) + '</td><td>' + lot + '</td><td>' + esc(r.message) + '</td>' +
               '<td class="muted">' + esc(T7.ago(r.created_at)) + '</td><td><span class="pill ' + s[1] + '">' + s[0] + '</span></td></tr>';
      }).join('') + '</tbody></table></div>';
    const jump = document.getElementById('jump-enquiries');
    if (jump) { jump.hidden = false; jump.textContent = 'My Enquiries (' + rows.length + ')'; }
  }

  /* ---------- Events ---------- */
  tabsEl.addEventListener('click', e => {
    const button = e.target.closest('[data-commodity]');
    if (!button) return;
    if (button.dataset.commodity) state.commodity = button.dataset.commodity;
    else delete state.commodity;
    state.f = {};   /* a diamond's clarity means nothing for gold */
    buildFilters();
    apply();
  });

  controls.addEventListener('change', e => {
    const el = e.target;
    if (el.type !== 'checkbox') return;
    const set = state.f[el.name] || [];
    state.f[el.name] = el.checked ? set.concat([el.value]) : set.filter(v => v !== el.value);
    if (!state.f[el.name].length) delete state.f[el.name];
    el.closest('.chip').classList.toggle('is-on', el.checked);
    apply();
  });

  let typeTimer;
  controls.addEventListener('input', e => {
    const el = e.target;
    if (el.name !== 'min' && el.name !== 'max') return;
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      if (el.value) state[el.name] = el.value; else delete state[el.name];
      apply();
    }, 250);
  });
  controls.addEventListener('submit', e => e.preventDefault());

  searchEl.addEventListener('input', () => {
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => {
      state.q = searchEl.value;
      if (!state.q) delete state.q;
      apply();
    }, 160);
  });

  sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });
  resetBtn.addEventListener('click', reset);

  if (toggle) {
    toggle.addEventListener('click', () => {
      const open = !controls.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Boot ---------- */
  state = readUrl();
  sortEl.value = state.sort;
  if (state.q) searchEl.value = state.q;

  board.innerHTML = '<div class="board-grid">' +
    '<div class="sk-card"><div class="skeleton sk-media"></div><div class="skeleton sk-line" style="width:40%"></div><div class="skeleton sk-line" style="width:75%"></div></div>'.repeat(3) +
  '</div>';

  /* Buyers and sellers. An admin gets in only with the pass that the
     dashboard's "View Trade Board" button sets (see js/admin.js), and
     then sees the lots without the buyer guidance around them. */
  function adminPass() { try { return sessionStorage.getItem('t7.admin-trade') === '1'; } catch (e) { return false; } }

  T7.auth.require().then(profile => {
    if (!profile) return;
    if (profile.role === 'admin') {
      if (!adminPass()) { location.replace('admin.html'); return; }
      document.querySelectorAll('.buying-summary, .catalogue-support, #alerts').forEach(el => { el.hidden = true; });
      document.getElementById('trade-intro').textContent = 'The board as buyers and sellers see it. Manage lots from the dashboard.';
    }
    paintWelcome(profile);
    if (profile.role === 'buyer') paintMyEnquiries();

    return T7.api.listLots().then(rows => {
      lots = rows;
      paintTabs();
      buildFilters();
      apply();
    });
  }).catch(err => {
    console.error(err);
    countEl.textContent = 'The board could not be loaded';
    board.innerHTML =
      '<div class="empty">' +
        '<h3>We could not reach the desk</h3>' +
        '<p>Please try again in a moment, or call the Kimberley office on +27 73 569 4045.</p>' +
        '<a href="contact.html" class="btn-desk">Contact Us</a>' +
      '</div>';
  });
})();
