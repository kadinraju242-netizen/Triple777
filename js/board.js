/* ============================================================
   Triple 7 Holdings — the Trade Desk board
   ------------------------------------------------------------
   Members only: signed-out visitors are sent to sign in and come
   straight back here.

   Built for few clicks:
     1 click  pick a group (precious stones, PGMs, ferrous …)
     1 click  pick a commodity within it (optional)
     1 click  open a lot, and ask the desk about it

   Thirty commodities sit in seven groups (see js/catalog.js). A
   commodity button shows how many lots it has; a commodity with
   none is still offered, so a buyer can see what the desk trades
   and ask us to source it.

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
  const groupsEl  = document.getElementById('commodity-groups');
  const welcomeEl = document.getElementById('trade-welcome');
  if (!board) return;

  const cat = T7.catalog;
  const esc = T7.esc;

  let lots = [];
  let state = { sort: 'newest', f: {} };
  const PAGE = 12;
  let pageSize = PAGE;

  /* ---------- URL <-> state ---------- */
  function readUrl() {
    const q = new URLSearchParams(location.search);
    const next = { sort: q.get('sort') || 'newest', f: {} };
    const c = q.get('commodity');
    if (c && cat.get(c)) { next.commodity = c; next.group = cat.get(c).group; }
    const g = q.get('group');
    if (!next.group && g && cat.group(g)) next.group = g;
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
    else if (state.group) q.set('group', state.group);
    if (state.q) q.set('q', state.q);
    if (state.min) q.set('min', state.min);
    if (state.max) q.set('max', state.max);
    Object.keys(state.f).forEach(k => { if (state.f[k].length) q.set('f.' + k, state.f[k].join('|')); });
    if (state.sort && state.sort !== 'newest') q.set('sort', state.sort);
    const qs = q.toString();
    history.replaceState(null, '', qs ? '?' + qs : location.pathname);
    resetBtn.hidden = !qs;
  }

  /* ---------- Group and commodity buttons ---------- */
  function counts() {
    const n = {};
    lots.forEach(l => { n[l.commodity] = (n[l.commodity] || 0) + 1; });
    return n;
  }

  function paintTabs() {
    const n = counts();
    const inGroup = g => g.items.reduce((sum, k) => sum + (n[k] || 0), 0);
    groupsEl.innerHTML =
      '<button type="button" data-group="" aria-pressed="' + !state.group + '">All<span>' + lots.length + '</span></button>' +
      cat.groups.map(g => '<button type="button" data-group="' + g.key + '" aria-pressed="' + (state.group === g.key) + '">' +
        esc(g.label) + '<span>' + inGroup(g) + '</span></button>').join('');

    const group = state.group && cat.group(state.group);
    if (!group) { tabsEl.innerHTML = ''; tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    const btn = (key, label, count) =>
      '<button type="button" data-commodity="' + key + '" aria-pressed="' + ((state.commodity || '') === key) + '"' +
        (key && !count ? ' class="is-empty"' : '') + '>' + esc(label) + ' <span>' + count + '</span></button>';
    tabsEl.innerHTML = btn('', 'All ' + group.label.toLowerCase(), inGroup(group)) +
      group.items.map(key => btn(key, cat.get(key).plural, n[key] || 0)).join('');
  }

  /* ---------- Filters ---------- */
  /* A filter is either a column on the lot ("type", "origin") or one of
     the per-commodity details kept in lot.specs. */
  function facetList() {
    /* "Type" (cut, bar, lump, cathode …) only means something within a
       group or a commodity; across all thirty it is just a long list. */
    const list = state.commodity || state.group
      ? [{ key: 'type', label: state.commodity ? cat.get(state.commodity).typeLabel : 'Type', get: l => l.type }] : [];
    if (state.commodity) {
      cat.get(state.commodity).fields.forEach(f => {
        list.push({ key: f.key, label: f.label, order: f.options, get: l => (l.specs || {})[f.key] });
      });
    }
    list.push({ key: 'origin', label: 'Origin', get: l => l.origin });
    return list;
  }

  const inCategory = () => lots.filter(l =>
    state.commodity ? l.commodity === state.commodity
      : state.group ? cat.get(l.commodity) && cat.get(l.commodity).group === state.group
      : true);

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
    pageSize = PAGE;
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

    paintTabs();
    render(list);
    writeUrl();
  }

  /* ---------- Render ---------- */
  function render(list) {
    const label = state.commodity ? cat.get(state.commodity).label.toLowerCase() + ' '
      : state.group ? cat.group(state.group).label.toLowerCase().replace(/s$/, '') + ' ' : '';
    countEl.textContent = list.length
      ? list.length + ' ' + label + (list.length === 1 ? 'lot' : 'lots')
      : 'No lots match';

    if (!list.length) {
      const wanted = state.commodity ? cat.get(state.commodity).plural.toLowerCase() : 'it';
      const ask = 'buyer.html?commodity=' + encodeURIComponent(state.commodity || '') + '#request';
      board.innerHTML =
        '<div class="empty td-empty">' +
          '<h3>' + (inCategory().length ? 'Nothing matches those filters' : 'Nothing listed here right now') + '</h3>' +
          '<p>' + (inCategory().length
            ? 'Clear a filter or two, or tell the desk exactly what you need and we will look for it.'
            : 'The desk can still source ' + esc(wanted) + ' for you. Tell us the grade, quantity and where it should go.') + '</p>' +
          '<div class="action-row">' +
            '<a href="' + ask + '" class="btn-desk">Request ' + esc(state.commodity ? cat.get(state.commodity).label.toLowerCase() : 'a commodity') + '</a>' +
            (inCategory().length ? '<button type="button" class="btn-line" id="empty-reset">Clear filters</button>' : '') +
          '</div>' +
        '</div>';
      const r = document.getElementById('empty-reset');
      if (r) r.addEventListener('click', reset);
      return;
    }
    /* A page at a time, so a long board stays quick to scan. */
    const shown = list.slice(0, pageSize);
    board.innerHTML = '<div class="board-grid">' + shown.map(T7.lotCard).join('') + '</div>' +
      (list.length > shown.length
        ? '<div class="td-more"><button type="button" class="btn-line" id="show-more">Show ' + Math.min(PAGE, list.length - shown.length) + ' more</button>' +
          '<span class="muted">' + shown.length + ' of ' + list.length + '</span></div>' : '');
    const more = document.getElementById('show-more');
    if (more) more.addEventListener('click', () => { pageSize += PAGE; render(list); });
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
    let action = '';
    if (profile.role === 'buyer') {
      action = '<a class="btn btn-solid" href="buyer.html#request">Request a commodity</a>' +
               '<a class="btn btn-ghost" href="buyer.html" id="jump-enquiries">My enquiries</a>' +
               '<a class="btn btn-ghost" href="signin.html?as=seller">' + (profile.is_seller ? 'Switch to selling' : 'Start selling') + '</a>';
    }
    if (profile.role === 'seller') {
      action = '<a class="btn btn-solid" href="seller.html#new">List a lot</a>' +
               '<a class="btn btn-ghost" href="seller.html">My dashboard</a>' +
               '<a class="btn btn-ghost" href="signin.html?as=buyer">' + (profile.is_buyer ? 'Switch to buying' : 'Start buying') + '</a>';
    }
    if (profile.role === 'admin') action = '<a class="btn btn-solid" href="admin.html">Back to dashboard</a>';
    welcomeEl.innerHTML = action +
      '<p class="td-signed-in">Signed in as <b>' + esc(T7.auth.displayName(profile)) + '</b>, ' +
        esc({ buyer: 'buying', seller: 'selling', admin: 'desk admin' }[profile.role]) + '.</p>';
    const cta = document.getElementById('request-cta');
    if (cta && profile.role === 'seller') cta.href = 'signin.html?as=buyer&next=' + encodeURIComponent('buyer.html#request');
  }

  async function countEnquiries() {
    let rows;
    try { rows = await T7.api.myEnquiries(); } catch (e) { return; }
    const waiting = rows.filter(r => r.status === 'answered').length;
    const jump = document.getElementById('jump-enquiries');
    if (jump && rows.length) jump.textContent = 'My enquiries (' + rows.length + ')' + (waiting ? ' · ' + waiting + ' answered' : '');
  }

  /* ---------- Events ---------- */
  groupsEl.addEventListener('click', e => {
    const button = e.target.closest('[data-group]');
    if (!button) return;
    if (button.dataset.group) state.group = button.dataset.group; else delete state.group;
    delete state.commodity;
    state.f = {};
    buildFilters();
    apply();
  });

  tabsEl.addEventListener('click', e => {
    const button = e.target.closest('[data-commodity]');
    if (!button) return;
    if (button.dataset.commodity) state.commodity = button.dataset.commodity;
    else delete state.commodity;
    state.f = {};   /* a diamond's clarity means nothing for coal */
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
      document.querySelectorAll('.td-steps, .td-request-cta, #alerts').forEach(el => { el.hidden = true; });
      document.getElementById('trade-intro').textContent = 'The board as buyers and sellers see it. Manage lots from the dashboard.';
    }
    paintWelcome(profile);
    if (profile.role === 'buyer') countEnquiries();

    return T7.api.listLots().then(rows => {
      lots = rows;
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
