/* ============================================================
   Triple 7 Holdings — admin dashboard
   ------------------------------------------------------------
   Everything in the Trade Desk database on one page:

     Overview    the numbers, what needs a decision, the charts
     Listings    every lot, with approve / reject
     Sellers     every seller and what they have listed
     Buyers      every buyer and what they have asked about
     Enquiries   every message between a buyer and a seller
     Documents   the supporting document filed with each listing
     Alerts      "tell me when new lots list" sign-ups

   Only an account whose role is "admin" gets data back. For anyone
   else this page is an empty shell: the database returns nothing
   (see the policies in supabase/01_schema.sql), and the guard at
   the bottom sends them away.

   The whole dataset is loaded once and filtered in the browser,
   which keeps every filter instant. That is fine for thousands of
   rows; beyond that, move the filters into the queries in
   js/api.js (T7.api.admin.load).
   ============================================================ */
(function () {
  const root   = document.getElementById('admin-root');
  const tabsEl = document.getElementById('admin-tabs');
  const sheet  = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheet-body');
  if (!root) return;

  const cat = T7.catalog;
  const esc = T7.esc;
  const DAY = 86400000;

  let me = null;
  let db = { profiles: [], lots: [], enquiries: [], documents: [], alerts: [] };
  let idx = {};
  let tab = 'overview';

  /* One set of filters and one sort per table, kept while you move
     between tabs. */
  const view = {
    listings:  { f: {}, sort: 'created_at', dir: -1 },
    sellers:   { f: {}, sort: 'live_value', dir: -1 },
    buyers:    { f: {}, sort: 'created_at', dir: -1 },
    enquiries: { f: {}, sort: 'created_at', dir: -1 },
    documents: { f: {}, sort: 'created_at', dir: -1 },
    alerts:    { f: {}, sort: 'created_at', dir: -1 }
  };

  const TABS = [
    ['overview', 'Overview'], ['listings', 'Listings'], ['sellers', 'Sellers'], ['buyers', 'Buyers'],
    ['enquiries', 'Enquiries'], ['documents', 'Documents'], ['alerts', 'Alerts']
  ];

  const DOC_STATUS  = { pending: ['Waiting for review', 'is-wait'], approved: ['Approved', 'is-good'], rejected: ['Rejected', 'is-bad'] };
  const ENQ_STATUS  = { new: ['New', 'is-new'], answered: ['Answered', 'is-good'], closed: ['Closed', ''] };
  const USER_STATUS = { active: ['Active', 'is-good'], suspended: ['Suspended', 'is-bad'] };

  /* ---------- Small helpers ---------- */
  /* Older databases (before 9 Oct 2026) kept one role per account. */
  const isBuyerFn = p => p.role !== 'admin' && (Boolean(p.is_buyer) || p.role === 'buyer');
  const isSellerFn = p => p.role !== 'admin' && (Boolean(p.is_seller) || p.role === 'seller');
  const sides = p => p.role === 'admin' ? 'Admin' : isBuyerFn(p) && isSellerFn(p) ? 'Buyer & seller' : isSellerFn(p) ? 'Seller' : isBuyerFn(p) ? 'Buyer' : 'Not chosen yet';
  const fullName = p => (p ? [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email : '—');
  const dateShort = iso => (iso ? new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const dateTime = iso => (iso ? new Date(iso).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const pill = pair => '<span class="pill ' + pair[1] + '">' + esc(pair[0]) + '</span>';
  const lotPill = l => { const s = cat.status[l.status]; return '<span class="pill is-' + s.tone + '">' + esc(s.short) + '</span>'; };
  const sum = (rows, get) => rows.reduce((t, r) => t + (Number(get(r)) || 0), 0);
  const options = (list, value, all) =>
    '<option value="">' + esc(all) + '</option>' +
    list.map(o => { const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
      return '<option value="' + esc(v) + '"' + (String(value || '') === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');

  /* Joins done once per load, so tables and charts only read. */
  function index() {
    const byId = {};
    db.profiles.forEach(p => { byId[p.id] = p; p.lots = []; p.sent = []; p.received = []; });
    const lotById = {};
    db.lots.forEach(l => {
      lotById[l.id] = l;
      l.seller = byId[l.seller_id] || null;
      l.enquiries = [];
      l.document = null;
      if (l.seller) l.seller.lots.push(l);
    });
    db.enquiries.forEach(e => {
      e.lot = lotById[e.lot_id] || null;
      e.buyer = byId[e.buyer_id] || null;
      e.seller = byId[e.seller_id] || null;
      if (e.lot) e.lot.enquiries.push(e);
      if (e.buyer) e.buyer.sent.push(e);
      if (e.seller) e.seller.received.push(e);
    });
    db.documents.forEach(d => {
      d.lot = lotById[d.lot_id] || null;
      d.seller = byId[d.seller_id] || null;
      if (d.lot) d.lot.document = d;
    });
    db.profiles.forEach(p => {
      p.live_value = sum(p.lots.filter(l => l.status === 'live'), l => l.price_zar);
      p.last_sent = p.sent.length ? p.sent.map(e => e.created_at).sort().pop() : null;
    });
    idx = {
      /* One account can be both, so it can appear in both lists. */
      sellers: db.profiles.filter(isSellerFn),
      buyers: db.profiles.filter(isBuyerFn),
      pendingLots: db.lots.filter(l => l.status === 'pending'),
      pendingDocs: db.documents.filter(d => d.status === 'pending')
    };
  }

  /* ---------- Tabs ---------- */
  function paintTabs() {
    const counts = { listings: idx.pendingLots.length, documents: idx.pendingDocs.length };
    tabsEl.innerHTML = TABS.map(t =>
      '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] +
      (counts[t[0]] ? ' <span class="count" title="Waiting for you">' + counts[t[0]] + '</span>' : '') + '</button>').join('');
    const el = document.getElementById('desk-count');
    if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  }

  function go(next, filters) {
    tab = next;
    if (filters && view[next]) view[next].f = filters;
    history.replaceState(null, '', '#' + next);
    paintTabs();
    render();
    window.scrollTo({ top: Math.max(0, document.querySelector('.admin-tabs').offsetTop - 90) });
  }

  /* ---------- Charts ---------- */
  function bars(rows, opts) {
    const o = opts || {};
    const max = Math.max.apply(null, rows.map(r => r.value).concat([1]));
    return '<div class="bars' + (o.wide ? ' is-wide' : '') + '">' + rows.map(r => {
      const inner =
        '<span class="bar-label">' + esc(r.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + (r.value / max * 100).toFixed(1) + '%"></span></span>' +
        '<span class="bar-value">' + esc(o.format ? o.format(r.value) : String(r.value)) + '</span>';
      const cls = 'bar-row' + (r.tone ? ' is-' + r.tone : '');
      return r.go
        ? '<button type="button" class="' + cls + '" data-go="' + esc(r.go[0]) + '" data-filters="' + esc(JSON.stringify(r.go[1])) + '" title="Show these in the table">' + inner + '</button>'
        : '<div class="' + cls + '">' + inner + '</div>';
    }).join('') + '</div>';
  }

  /* Twelve weeks, oldest first. One measure per chart, one axis. */
  function weekly(rows, noun) {
    const weeks = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) weeks.push({ from: now - (i + 1) * 7 * DAY, to: now - i * 7 * DAY, n: 0 });
    rows.forEach(r => {
      const t = new Date(r.created_at).getTime();
      const w = weeks.find(x => t > x.from && t <= x.to);
      if (w) w.n++;
    });
    const max = Math.max.apply(null, weeks.map(w => w.n).concat([1]));
    const label = w => new Date(w.to).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
    const total = sum(weeks, w => w.n);
    return '<div class="cols" role="img" aria-label="' + esc(total + ' ' + noun + ' in the last 12 weeks') + '">' +
        weeks.map(w =>
          '<div class="col" tabindex="0"><i style="height:' + (w.n / max * 100).toFixed(1) + '%"></i>' +
          '<span class="col-tip">' + w.n + ' ' + esc(noun) + '<br>week to ' + esc(label(w)) + '</span></div>').join('') +
      '</div>' +
      '<div class="cols-axis" aria-hidden="true">' + weeks.map((w, i) => '<span>' + (i % 2 ? '' : esc(label(w))) + '</span>').join('') + '</div>' +
      '<p class="chart-note">' + total + ' in the last 12 weeks · busiest week ' + max + '</p>';
  }

  /* ---------- Overview ---------- */
  function kpi(label, value, note, go, action) {
    return '<button type="button" class="kpi' + (action ? ' is-action' : '') + '" data-go="' + go[0] + '" data-filters="' + esc(JSON.stringify(go[1] || {})) + '">' +
      '<p class="kpi-label">' + esc(label) + '</p><p class="kpi-value">' + esc(String(value)) + '</p>' +
      (note ? '<p class="kpi-note">' + esc(note) + '</p>' : '') + '</button>';
  }

  function overview() {
    const live = db.lots.filter(l => l.status === 'live');
    const sold = db.lots.filter(l => l.status === 'sold');
    const newEnq = db.enquiries.filter(e => e.status === 'new');
    const week = Date.now() - 7 * DAY;
    const joined = db.profiles.filter(p => new Date(p.created_at).getTime() > week).length;

    const queue = idx.pendingLots.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 5);

    const byCat = cat.order.map(k => ({
      label: cat.get(k).plural, value: live.filter(l => l.commodity === k).length, go: ['listings', { commodity: k, status: 'live' }]
    }));
    const valueByCat = cat.order.map(k => ({
      label: cat.get(k).plural, value: sum(live.filter(l => l.commodity === k), l => l.price_zar), go: ['listings', { commodity: k, status: 'live' }]
    }));
    const byStatus = Object.keys(cat.status).map(k => ({
      label: cat.status[k].short, value: db.lots.filter(l => l.status === k).length, tone: cat.status[k].tone, go: ['listings', { status: k }]
    }));
    const enqByCat = cat.order.map(k => ({
      label: cat.get(k).plural, value: db.enquiries.filter(e => e.lot && e.lot.commodity === k).length, go: ['enquiries', { commodity: k }]
    }));
    const topSellers = idx.sellers.slice().sort((a, b) => b.live_value - a.live_value).slice(0, 6)
      .map(p => ({ label: p.company || fullName(p), value: p.live_value, go: ['listings', { seller: p.id }] }));
    const countries = {};
    db.profiles.forEach(p => { if (p.role !== 'admin') { const c = p.country || 'Not given'; countries[c] = (countries[c] || 0) + 1; } });
    const byCountry = Object.keys(countries).map(c => ({ label: c, value: countries[c] })).sort((a, b) => b.value - a.value).slice(0, 6);

    return '' +
      '<div class="kpi-grid">' +
        kpi('Lots waiting for approval', idx.pendingLots.length, idx.pendingLots.length ? 'Oldest: ' + T7.ago(queue[0].created_at) : 'All caught up', ['listings', { status: 'pending' }], idx.pendingLots.length) +
        kpi('Documents to review', idx.pendingDocs.length, idx.pendingDocs.length ? 'Filed with listings' : 'All caught up', ['documents', { status: 'pending' }], idx.pendingDocs.length) +
        kpi('Live lots', live.length, cat.moneyShort(sum(live, l => l.price_zar)) + ' asking in total', ['listings', { status: 'live' }]) +
        kpi('Sellers', idx.sellers.length, idx.sellers.filter(p => p.lots.some(l => l.status === 'live')).length + ' with a live lot', ['sellers', {}]) +
        kpi('Buyers', idx.buyers.length, idx.buyers.filter(p => p.sent.length).length + ' have enquired', ['buyers', {}]) +
        kpi('Enquiries', db.enquiries.length, newEnq.length + ' not yet answered', ['enquiries', {}]) +
        kpi('Sold', sold.length, cat.moneyShort(sum(sold, l => l.price_zar)) + ' at asking price', ['listings', { status: 'sold' }]) +
        kpi('New accounts this week', joined, db.alerts.length + ' alert sign-ups', ['buyers', {}]) +
      '</div>' +

      '<section class="card" style="margin-bottom:20px">' +
        '<div class="card-head"><h2>Waiting for your decision</h2>' +
          (idx.pendingLots.length > queue.length ? '<button type="button" class="linklike" data-go="listings" data-filters=\'{"status":"pending"}\'>See all ' + idx.pendingLots.length + '</button>' : '<p>Oldest first</p>') + '</div>' +
        (queue.length
          ? '<div class="queue">' + queue.map(l =>
              '<div class="queue-item"><div>' +
                '<span class="cell-main">' + esc(l.name) + ' · ' + esc(cat.money(l.price_zar)) + '</span>' +
                '<span class="muted">' + esc(l.lot_id) + ' · ' + esc(cat.summary(l).join(' · ')) + ' · from ' + esc(l.seller ? (l.seller.company || fullName(l.seller)) : 'unknown seller') + ' · ' + esc(T7.ago(l.created_at)) + '</span>' +
              '</div><div class="actions">' +
                '<button type="button" class="btn-line btn-sm" data-open="lot" data-id="' + l.id + '">Details</button>' +
                '<button type="button" class="btn-line btn-sm btn-danger" data-open="lot" data-id="' + l.id + '" data-intent="reject">Reject</button>' +
                '<button type="button" class="btn-desk btn-sm" data-review="live" data-id="' + l.id + '">Approve</button>' +
              '</div></div>').join('') + '</div>'
          : '<p class="card-sub">Nothing is waiting. New listings from sellers will appear here.</p>') +
      '</section>' +

      '<div class="two-col">' +
        '<section class="card"><div class="card-head"><h2>Live lots by category</h2><p>Number of lots</p></div>' + bars(byCat) + '</section>' +
        '<section class="card"><div class="card-head"><h2>Value on the board by category</h2><p>Asking prices, live lots</p></div>' + bars(valueByCat, { format: cat.moneyShort }) + '</section>' +
      '</div>' +
      '<div class="two-col">' +
        '<section class="card"><div class="card-head"><h2>All lots by status</h2><p>' + db.lots.length + ' lots ever listed</p></div>' + bars(byStatus) + '</section>' +
        '<section class="card"><div class="card-head"><h2>Enquiries by category</h2><p>What buyers ask about</p></div>' + bars(enqByCat) + '</section>' +
      '</div>' +
      '<div class="two-col">' +
        '<section class="card"><div class="card-head"><h2>New listings per week</h2><p>Last 12 weeks</p></div>' + weekly(db.lots, 'listings') + '</section>' +
        '<section class="card"><div class="card-head"><h2>Enquiries per week</h2><p>Last 12 weeks</p></div>' + weekly(db.enquiries, 'enquiries') + '</section>' +
      '</div>' +
      '<div class="two-col">' +
        '<section class="card"><div class="card-head"><h2>New accounts per week</h2><p>Buyers and sellers, last 12 weeks</p></div>' + weekly(db.profiles.filter(p => p.role !== 'admin'), 'accounts') + '</section>' +
        '<section class="card"><div class="card-head"><h2>Where accounts are from</h2><p>Top countries</p></div>' + bars(byCountry, { wide: true }) + '</section>' +
      '</div>' +
      '<section class="card"><div class="card-head"><h2>Sellers with the most on the board</h2><p>Asking value of live lots</p></div>' +
        (topSellers.some(s => s.value) ? bars(topSellers.filter(s => s.value), { format: cat.moneyShort, wide: true }) : '<p class="card-sub">No live lots yet.</p>') + '</section>';
  }

  /* ---------- Tables ----------
     Each table: its columns, its filter bar, and how a row passes the
     filters. Sorting and CSV export are shared. */
  const txt = (row, parts) => parts.filter(Boolean).join(' ').toLowerCase();

  const TABLES = {
    listings: {
      title: 'Listings', rows: () => db.lots, open: 'lot',
      filters(f) {
        return search(f, 'Lot, ID, seller…') +
          sel('commodity', 'Category', cat.order.map(k => [k, cat.get(k).plural]), f, 'All categories') +
          sel('status', 'Status', Object.keys(cat.status).map(k => [k, cat.status[k].short]), f, 'Any status') +
          sel('seller', 'Seller', idx.sellers.map(p => [p.id, p.company || fullName(p)]).sort((a, b) => a[1].localeCompare(b[1])), f, 'All sellers') +
          sel('cert', 'Certificate', [['yes', 'Certified'], ['no', 'Not certified']], f, 'Any') +
          range('min', 'max', 'Price from (R)', 'Price to (R)', f) + dates(f);
      },
      match(l, f) {
        if (f.commodity && l.commodity !== f.commodity) return false;
        if (f.status && l.status !== f.status) return false;
        if (f.seller && l.seller_id !== f.seller) return false;
        if (f.cert) { const c = (l.specs || {}).certificate; const has = Boolean(c && c !== 'None'); if ((f.cert === 'yes') !== has) return false; }
        if (f.min && Number(l.price_zar) < Number(f.min)) return false;
        if (f.max && Number(l.price_zar) > Number(f.max)) return false;
        if (!inDates(l.created_at, f)) return false;
        if (f.q && txt(l, [l.lot_id, l.name, l.type, l.origin, l.description, l.seller && fullName(l.seller), l.seller && l.seller.company, l.seller && l.seller.email]
          .concat(Object.keys(l.specs || {}).map(k => l.specs[k]))).indexOf(f.q.toLowerCase()) === -1) return false;
        return true;
      },
      cols: [
        { key: 'name', label: 'Lot', get: l => l.name, html: l => '<span class="cell-main">' + esc(l.name) + '</span><span class="muted">' + esc(l.lot_id) + ' · ' + esc(cat.summary(l).join(' · ')) + '</span>' },
        { key: 'commodity', label: 'Category', get: l => cat.label(l.commodity) },
        { key: 'seller', label: 'Seller', get: l => (l.seller ? l.seller.company || fullName(l.seller) : ''), html: l => (l.seller ? esc(l.seller.company || fullName(l.seller)) + '<span class="muted" style="display:block">' + esc(l.seller.email) + '</span>' : '—') },
        { key: 'price_zar', label: 'Asking price', num: true, get: l => Number(l.price_zar), html: l => '<span class="strong">' + esc(cat.money(l.price_zar)) + '</span>' },
        { key: 'weight', label: 'Weight', num: true, get: l => (l.weight_unit === 'ct' ? Number(l.weight) * 0.2 : Number(l.weight)) || 0, html: l => esc(cat.weight(l)), csv: l => cat.weight(l) },
        { key: 'enq', label: 'Enquiries', num: true, get: l => l.enquiries.length },
        { key: 'created_at', label: 'Listed', get: l => l.created_at, cls: 'nw', html: l => esc(dateShort(l.created_at)), csv: l => l.created_at },
        { key: 'status', label: 'Status', get: l => cat.status[l.status].short, html: lotPill },
        { key: '_', label: '', html: l => (l.status === 'pending'
            ? '<button type="button" class="btn-desk btn-sm" data-review="live" data-id="' + l.id + '">Approve</button>' : ''), cls: 'actions' }
      ]
    },

    sellers: {
      title: 'Sellers', rows: () => idx.sellers, open: 'user',
      filters(f) {
        return search(f, 'Name, company, email…') + countrySel(idx.sellers, f) +
          sel('status', 'Account', [['active', 'Active'], ['suspended', 'Suspended']], f, 'Any') +
          sel('has', 'Listings', [['live', 'Has a live lot'], ['pending', 'Has a lot waiting'], ['none', 'Has listed nothing']], f, 'Any') + dates(f, 'Joined');
      },
      match(p, f) {
        if (!matchUser(p, f)) return false;
        if (f.has === 'live' && !p.lots.some(l => l.status === 'live')) return false;
        if (f.has === 'pending' && !p.lots.some(l => l.status === 'pending')) return false;
        if (f.has === 'none' && p.lots.length) return false;
        return true;
      },
      cols: [
        { key: 'name', label: 'Seller', get: p => p.company || fullName(p), html: p => '<span class="cell-main">' + esc(p.company || fullName(p)) + '</span><span class="muted">' + esc(fullName(p)) + (isBuyerFn(p) ? ' · also buys' : '') + '</span>' },
        { key: 'email', label: 'Contact', get: p => p.email, html: contact },
        { key: 'country', label: 'Country', get: p => p.country || '' },
        { key: 'live', label: 'Live', num: true, get: p => p.lots.filter(l => l.status === 'live').length },
        { key: 'pending', label: 'Waiting', num: true, get: p => p.lots.filter(l => l.status === 'pending').length },
        { key: 'total', label: 'All lots', num: true, get: p => p.lots.length },
        { key: 'live_value', label: 'Live value', num: true, get: p => p.live_value, html: p => '<span class="strong">' + esc(cat.money(p.live_value)) + '</span>' },
        { key: 'received', label: 'Enquiries', num: true, get: p => p.received.length },
        { key: 'created_at', label: 'Joined', get: p => p.created_at, cls: 'nw', html: p => esc(dateShort(p.created_at)), csv: p => p.created_at },
        { key: 'status', label: 'Account', get: p => USER_STATUS[p.status][0], html: p => pill(USER_STATUS[p.status]) }
      ]
    },

    buyers: {
      title: 'Buyers', rows: () => idx.buyers, open: 'user',
      filters(f) {
        return search(f, 'Name, company, email…') + countrySel(idx.buyers, f) +
          sel('status', 'Account', [['active', 'Active'], ['suspended', 'Suspended']], f, 'Any') +
          sel('has', 'Activity', [['yes', 'Has enquired'], ['no', 'Never enquired']], f, 'Any') + dates(f, 'Joined');
      },
      match(p, f) {
        if (!matchUser(p, f)) return false;
        if (f.has === 'yes' && !p.sent.length) return false;
        if (f.has === 'no' && p.sent.length) return false;
        return true;
      },
      cols: [
        { key: 'name', label: 'Buyer', get: p => fullName(p), html: p => '<span class="cell-main">' + esc(fullName(p)) + '</span>' + (p.company || isSellerFn(p) ? '<span class="muted">' + esc([p.company, isSellerFn(p) ? 'also sells' : ''].filter(Boolean).join(' · ')) + '</span>' : '') },
        { key: 'email', label: 'Contact', get: p => p.email, html: contact },
        { key: 'country', label: 'Country', get: p => p.country || '' },
        { key: 'sent', label: 'Enquiries sent', num: true, get: p => p.sent.length },
        { key: 'last_sent', label: 'Last enquiry', get: p => p.last_sent || '', html: p => (p.last_sent ? esc(T7.ago(p.last_sent)) : '<span class="muted">Never</span>') },
        { key: 'created_at', label: 'Joined', get: p => p.created_at, cls: 'nw', html: p => esc(dateShort(p.created_at)), csv: p => p.created_at },
        { key: 'status', label: 'Account', get: p => USER_STATUS[p.status][0], html: p => pill(USER_STATUS[p.status]) }
      ]
    },

    enquiries: {
      title: 'Enquiries', rows: () => db.enquiries, open: 'enquiry',
      filters(f) {
        return search(f, 'Ref, buyer, lot, message…') +
          sel('status', 'Status', Object.keys(ENQ_STATUS).map(k => [k, ENQ_STATUS[k][0]]), f, 'Any status') +
          sel('commodity', 'Category', cat.order.map(k => [k, cat.get(k).plural]), f, 'All categories') +
          sel('seller', 'Seller', idx.sellers.map(p => [p.id, p.company || fullName(p)]).sort((a, b) => a[1].localeCompare(b[1])), f, 'All sellers') + dates(f, 'Sent');
      },
      match(e, f) {
        if (f.status && e.status !== f.status) return false;
        if (f.commodity && (!e.lot || e.lot.commodity !== f.commodity)) return false;
        if (f.seller && e.seller_id !== f.seller) return false;
        if (f.buyer && e.buyer_id !== f.buyer) return false;
        if (!inDates(e.created_at, f)) return false;
        if (f.q && txt(e, [e.ref, e.buyer_name, e.buyer_email, e.message, e.lot && e.lot.name, e.lot && e.lot.lot_id, e.seller && e.seller.company, e.seller && fullName(e.seller)]).indexOf(f.q.toLowerCase()) === -1) return false;
        return true;
      },
      cols: [
        { key: 'ref', label: 'Ref', get: e => e.ref, html: e => '<span class="muted">' + esc(e.ref) + '</span>' },
        { key: 'buyer', label: 'Buyer', get: e => e.buyer_name || '', html: e => '<span class="cell-main">' + esc(e.buyer_name || '—') + '</span><span class="muted">' + esc(e.buyer_email || '') + '</span>' },
        { key: 'lot', label: 'Lot', get: e => (e.lot ? e.lot.name : ''), html: e => (e.lot ? esc(e.lot.name) + '<span class="muted" style="display:block">' + esc(e.lot.lot_id) + ' · ' + esc(cat.money(e.lot.price_zar)) + '</span>' : '—') },
        { key: 'seller', label: 'Seller', get: e => (e.seller ? e.seller.company || fullName(e.seller) : ''), html: e => esc(e.seller ? e.seller.company || fullName(e.seller) : '—') },
        { key: 'message', label: 'Message', get: e => e.message, html: e => '<span style="display:block;max-width:320px">' + esc(e.message.length > 90 ? e.message.slice(0, 88) + '…' : e.message) + '</span>' },
        { key: 'created_at', label: 'Sent', get: e => e.created_at, cls: 'nw', html: e => esc(T7.ago(e.created_at)), csv: e => e.created_at },
        { key: 'status', label: 'Status', get: e => ENQ_STATUS[e.status][0], html: e => pill(ENQ_STATUS[e.status]) }
      ]
    },

    documents: {
      title: 'Documents', rows: () => db.documents, open: 'document',
      filters(f) {
        return search(f, 'Seller or lot…') +
          sel('status', 'Status', Object.keys(DOC_STATUS).map(k => [k, DOC_STATUS[k][0]]), f, 'Any status') +
          sel('seller', 'Seller', idx.sellers.map(p => [p.id, p.company || fullName(p)]).sort((a, b) => a[1].localeCompare(b[1])), f, 'All sellers') + dates(f, 'Filed');
      },
      match(d, f) {
        if (f.status && d.status !== f.status) return false;
        if (f.seller && d.seller_id !== f.seller) return false;
        if (!inDates(d.created_at, f)) return false;
        if (f.q && txt(d, [d.doc_type, d.file_name, d.seller && fullName(d.seller), d.seller && d.seller.company, d.lot && d.lot.name, d.lot && d.lot.lot_id]).indexOf(f.q.toLowerCase()) === -1) return false;
        return true;
      },
      cols: [
        { key: 'seller', label: 'Seller', get: d => (d.seller ? d.seller.company || fullName(d.seller) : ''), html: d => (d.seller ? '<span class="cell-main">' + esc(d.seller.company || fullName(d.seller)) + '</span><span class="muted">' + esc(d.seller.email) + '</span>' : '—') },
        { key: 'lot', label: 'Filed with', get: d => (d.lot ? d.lot.name : ''), html: d => (d.lot ? esc(d.lot.name) + '<span class="muted" style="display:block">' + esc(d.lot.lot_id) + '</span>' : '—') },
        { key: 'doc_type', label: 'Document', get: d => d.doc_type, html: d => esc(d.doc_type) + '<span class="muted" style="display:block">' + (d.file_name ? esc(d.file_name) : 'Empty — nothing attached') + '</span>' },
        { key: 'created_at', label: 'Filed', get: d => d.created_at, cls: 'nw', html: d => esc(dateShort(d.created_at)), csv: d => d.created_at },
        { key: 'status', label: 'Status', get: d => DOC_STATUS[d.status][0], html: d => pill(DOC_STATUS[d.status]) },
        { key: '_', label: '', cls: 'actions', html: d => (d.status === 'pending'
            ? '<button type="button" class="btn-line btn-sm btn-danger" data-doc="rejected" data-id="' + d.id + '">Reject</button>' +
              '<button type="button" class="btn-desk btn-sm" data-doc="approved" data-id="' + d.id + '">Approve</button>' : '') }
      ]
    },

    alerts: {
      title: 'Alert sign-ups', rows: () => db.alerts,
      filters(f) { return search(f, 'Email…') + sel('interest', 'Interested in', [['diamond', 'Diamonds'], ['gold', 'Gold']], f, 'Anything') + dates(f, 'Signed up'); },
      match(a, f) {
        if (f.interest && (a.interests || []).indexOf(f.interest) === -1) return false;
        if (!inDates(a.created_at, f)) return false;
        if (f.q && a.email.toLowerCase().indexOf(f.q.toLowerCase()) === -1) return false;
        return true;
      },
      cols: [
        { key: 'email', label: 'Email', get: a => a.email, html: a => '<a class="textlink cell-main" href="mailto:' + esc(a.email) + '">' + esc(a.email) + '</a>' },
        { key: 'interests', label: 'Wants to hear about', get: a => (a.interests || []).map(cat.label).join(', ') },
        { key: 'created_at', label: 'Signed up', get: a => a.created_at, cls: 'nw', html: a => esc(dateShort(a.created_at)), csv: a => a.created_at }
      ]
    }
  };

  /* Filter-bar pieces */
  function search(f, placeholder) {
    return '<label class="grow">Search<input type="search" data-f="q" value="' + esc(f.q || '') + '" placeholder="' + esc(placeholder) + '"></label>';
  }
  function sel(key, label, list, f, all) {
    return '<label>' + esc(label) + '<select data-f="' + key + '">' + options(list, f[key], all) + '</select></label>';
  }
  function range(a, b, la, lb, f) {
    return '<div class="range" style="display:contents">' +
      '<label>' + la + '<input type="number" min="0" step="1000" data-f="' + a + '" value="' + esc(f[a] || '') + '"></label>' +
      '<label>' + lb + '<input type="number" min="0" step="1000" data-f="' + b + '" value="' + esc(f[b] || '') + '"></label></div>';
  }
  function dates(f, word) {
    const w = word || 'Listed';
    return '<label>' + w + ' from<input type="date" data-f="from" value="' + esc(f.from || '') + '"></label>' +
           '<label>' + w + ' to<input type="date" data-f="to" value="' + esc(f.to || '') + '"></label>';
  }
  function inDates(iso, f) {
    const day = (iso || '').slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    return true;
  }
  function countrySel(list, f) {
    const set = {};
    list.forEach(p => { if (p.country) set[p.country] = 1; });
    return sel('country', 'Country', Object.keys(set).sort(), f, 'All countries');
  }
  function matchUser(p, f) {
    if (f.country && p.country !== f.country) return false;
    if (f.status && p.status !== f.status) return false;
    if (!inDates(p.created_at, f)) return false;
    if (f.q && txt(p, [fullName(p), p.company, p.email, p.phone, p.country]).indexOf(f.q.toLowerCase()) === -1) return false;
    return true;
  }
  function contact(p) {
    return '<a class="textlink" href="mailto:' + esc(p.email) + '" data-stop>' + esc(p.email) + '</a>' +
           (p.phone ? '<span class="muted" style="display:block">' + esc(p.phone) + '</span>' : '');
  }

  function visibleRows(name) {
    const t = TABLES[name], v = view[name];
    const col = t.cols.find(c => c.key === v.sort);
    const sortGet = col ? col.get : (r => r[v.sort]);
    return t.rows().filter(r => t.match(r, v.f)).sort((a, b) => {
      const x = sortGet(a), y = sortGet(b);
      const cmp = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), undefined, { numeric: true });
      return cmp * v.dir;
    });
  }

  function tableBody(name) {
    const t = TABLES[name], v = view[name];
    const rows = visibleRows(name);
    const total = t.rows().length;
    const head = t.cols.map(c => {
      if (!c.get) return '<th></th>';
      const on = v.sort === c.key;
      return '<th' + (c.num ? ' class="num"' : '') + (on ? ' aria-sort="' + (v.dir === 1 ? 'ascending' : 'descending') + '"' : '') + '>' +
             '<button type="button" data-sort="' + c.key + '">' + esc(c.label) + '</button></th>';
    }).join('');
    const body = rows.map(r =>
      '<tr' + (t.open ? ' class="is-click" data-open="' + t.open + '" data-id="' + esc(r.id) + '"' : '') + '>' +
      t.cols.map(c => '<td class="' + (c.num ? 'num ' : '') + (c.cls || '') + '">' + (c.html ? c.html(r) : esc(c.get(r))) + '</td>').join('') + '</tr>').join('');
    let extra = '';
    if (name === 'listings' && rows.length) extra = ' · ' + cat.money(sum(rows, l => l.price_zar)) + ' asking in total';
    return '<div class="table-wrap"><table class="data-table"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>' +
        (rows.length ? '' : '<p class="table-empty">Nothing matches these filters.</p>') + '</div>' +
      '<div class="table-foot"><span>Showing ' + rows.length + ' of ' + total + extra + (t.open ? ' · click a row for details' : '') + '</span>' +
        '<button type="button" class="linklike" data-csv="' + name + '">Download as CSV</button></div>';
  }

  function tableView(name) {
    const t = TABLES[name], v = view[name];
    const active = Object.keys(v.f).filter(k => v.f[k]).length;
    return '<div class="card-head" style="margin-bottom:14px"><h2 style="font-size:22px;font-weight:600;letter-spacing:-.03em">' + esc(t.title) + '</h2>' +
        '<button type="button" class="linklike" data-clear="' + name + '"' + (active ? '' : ' hidden') + '>Clear filters</button></div>' +
      '<div class="filters" data-table="' + name + '">' + t.filters(v.f) + '</div>' +
      '<div id="table-body">' + tableBody(name) + '</div>';
  }

  function render() {
    root.innerHTML = tab === 'overview' ? overview() : tableView(tab);
  }

  /* ---------- CSV ---------- */
  function downloadCsv(name) {
    const t = TABLES[name];
    const cols = t.cols.filter(c => c.get);
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [cols.map(c => cell(c.label)).join(',')]
      .concat(visibleRows(name).map(r => cols.map(c => cell(c.csv ? c.csv(r) : c.get(r))).join(',')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'triple7-' + name + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /* ---------- Detail sheets ---------- */
  function dl(rows) {
    return '<dl class="spec-list">' + rows.filter(r => r[1] != null && r[1] !== '')
      .map(r => '<div><dt>' + esc(r[0]) + '</dt><dd>' + (r[2] ? r[1] : esc(r[1])) + '</dd></div>').join('') + '</dl>';
  }

  function openSheet(html) {
    sheetBody.innerHTML = '<div class="sheet-inner"><button type="button" class="sheet-close" data-close aria-label="Close">×</button>' + html + '</div>';
    if (!sheet.open) sheet.showModal();
  }

  function lotSheet(l, intent) {
    const c = cat.get(l.commodity);
    const specs = l.specs || {};
    const rows = [
      ['Status', lotPill(l), true],
      ['Asking price', cat.money(l.price_zar)],
      ['Category', cat.label(l.commodity)],
      [c.typeLabel, l.type],
      ['Weight', cat.weight(l)]
    ].concat(c.fields.map(f => [f.label, specs[f.key]])).concat([
      ['Pieces', l.quantity],
      ['Origin', l.origin],
      ['Seller', l.seller ? (l.seller.company || fullName(l.seller)) + ' · ' + l.seller.email : '—'],
      ['Listed', dateTime(l.created_at)],
      ['Document', l.document ? pill(DOC_STATUS[l.document.status]) : '—', true],
      ['Enquiries', l.enquiries.length],
      ['Reviewed', l.reviewed_at ? dateTime(l.reviewed_at) + (l.reviewed_by && l.reviewed_by === me.id ? ' by you' : '') : ''],
      ['Note to seller', l.review_note]
    ]);
    const buttons = [];
    if (l.status === 'pending' || l.status === 'rejected') buttons.push('<button type="button" class="btn-desk" data-review="live" data-id="' + l.id + '">Approve And Publish</button>');
    if (l.status === 'pending' || l.status === 'live') buttons.push('<button type="button" class="btn-line btn-danger" data-review="rejected" data-id="' + l.id + '">' + (l.status === 'live' ? 'Take Down' : 'Reject') + '</button>');
    if (l.status === 'live') buttons.push('<button type="button" class="btn-line" data-admin-trade="lot.html?id=' + encodeURIComponent(l.lot_id) + '">View On The Board</button>');
    buttons.push('<button type="button" class="btn-line btn-danger" data-delete-lot="' + l.id + '">Delete</button>');

    openSheet(
      '<h2 id="sheet-title">' + esc(l.name) + '</h2><p class="muted">' + esc(l.lot_id) + '</p>' +
      (l.description ? '<p style="margin-top:14px;color:var(--text-dark-2);font-size:14px">' + esc(l.description) + '</p>' : '') +
      dl(rows) +
      (l.status === 'pending' || l.status === 'live' || l.status === 'rejected'
        ? '<label class="sr-only" for="review-note">Note to the seller</label>' +
          '<textarea id="review-note" placeholder="Note to the seller (shown to them if you reject or take it down)">' + esc(l.review_note || '') + '</textarea>' : '') +
      '<p class="form-error" id="sheet-error" role="alert" hidden></p>' +
      '<div class="action-row">' + buttons.join('') + '</div>');
    if (intent === 'reject') { const n = document.getElementById('review-note'); if (n) n.focus(); }
  }

  /* `as` is the list it was opened from: an account that buys and
     sells shows its lots from Sellers and its enquiries from Buyers. */
  function userSheet(p, as) {
    const isSeller = as ? as === 'seller' : (isSellerFn(p) && !isBuyerFn(p));
    const list = isSeller
      ? p.lots.slice(0, 8).map(l => '<div><dt>' + esc(l.lot_id) + ' · ' + esc(l.name) + '</dt><dd>' + esc(cat.money(l.price_zar)) + ' ' + lotPill(l) + '</dd></div>').join('')
      : p.sent.slice(0, 8).map(e => '<div><dt>' + esc(e.ref) + ' · ' + esc(e.lot ? e.lot.name : 'Lot removed') + '</dt><dd>' + pill(ENQ_STATUS[e.status]) + '</dd></div>').join('');
    openSheet(
      '<h2 id="sheet-title">' + esc(isSeller ? (p.company || fullName(p)) : fullName(p)) + '</h2>' +
      '<p class="muted">' + esc(sides(p)) + ' account</p>' +
      dl([
        ['Account', pill(USER_STATUS[p.status]), true],
        ['Can', sides(p)],
        ['Name', fullName(p)], ['Company', p.company], ['Email', p.email], ['Phone', p.phone], ['Country', p.country],
        ['Joined', dateTime(p.created_at)]
      ].concat(isSeller
        ? [['Lots listed', p.lots.length], ['Live value', cat.money(p.live_value)], ['Enquiries received', p.received.length]]
        : [['Enquiries sent', p.sent.length]])) +
      (list ? '<h3 style="font-size:14px;font-weight:700;margin-top:22px">' + (isSeller ? 'Their lots' : 'Their enquiries') + '</h3><dl class="spec-list" style="margin-top:6px">' + list + '</dl>' : '') +
      '<p class="form-error" id="sheet-error" role="alert" hidden></p>' +
      '<div class="action-row">' +
        '<button type="button" class="btn-line" data-go="' + (isSeller ? 'listings' : 'enquiries') + '" data-filters="' + esc(JSON.stringify(isSeller ? { seller: p.id } : { buyer: p.id })) + '">See All ' + (isSeller ? 'Their Lots' : 'Their Enquiries') + '</button>' +
        '<a class="btn-line" href="mailto:' + esc(p.email) + '">Email</a>' +
        (p.status === 'active'
          ? '<button type="button" class="btn-line btn-danger" data-user="suspended" data-id="' + p.id + '">Suspend Account</button>'
          : '<button type="button" class="btn-desk" data-user="active" data-id="' + p.id + '">Reactivate Account</button>') +
        '<button type="button" class="btn-line btn-danger" data-delete-user="' + p.id + '">Delete Account</button>' +
      '</div>');
  }

  function enquirySheet(e) {
    openSheet(
      '<h2 id="sheet-title">Enquiry ' + esc(e.ref) + '</h2><p class="muted">' + esc(dateTime(e.created_at)) + '</p>' +
      '<p style="margin-top:16px;font-size:15px;white-space:pre-wrap">' + esc(e.message) + '</p>' +
      dl([
        ['Status', pill(ENQ_STATUS[e.status]), true],
        ['Buyer', (e.buyer_name || '—') + ' · ' + (e.buyer_email || '')], ['Buyer phone', e.buyer_phone],
        ['Lot', e.lot ? e.lot.lot_id + ' · ' + e.lot.name : 'Removed'], ['Asking price', e.lot ? cat.money(e.lot.price_zar) : ''],
        ['Seller', e.seller ? (e.seller.company || fullName(e.seller)) + ' · ' + e.seller.email : '—']
      ]) +
      '<p class="form-error" id="sheet-error" role="alert" hidden></p>' +
      '<div class="action-row">' +
        (e.status !== 'closed' ? '<button type="button" class="btn-line" data-enq="closed" data-id="' + e.id + '">Close Enquiry</button>'
                               : '<button type="button" class="btn-line" data-enq="new" data-id="' + e.id + '">Reopen</button>') +
        (e.lot ? '<button type="button" class="btn-line" data-open="lot" data-id="' + e.lot.id + '">Open The Lot</button>' : '') +
      '</div>');
  }

  function documentSheet(d) {
    openSheet(
      '<h2 id="sheet-title">' + esc(d.doc_type) + '</h2><p class="muted">Filed ' + esc(dateTime(d.created_at)) + '</p>' +
      '<div class="doc-step" style="margin-top:16px">' + (d.file_name
        ? '<strong>' + esc(d.file_name) + '</strong>'
        : '<strong>This document is empty.</strong> Sellers cannot attach files yet, so there is nothing to open. You can still record your decision.') + '</div>' +
      dl([
        ['Status', pill(DOC_STATUS[d.status]), true],
        ['Seller', d.seller ? (d.seller.company || fullName(d.seller)) + ' · ' + d.seller.email : '—'],
        ['Filed with', d.lot ? d.lot.lot_id + ' · ' + d.lot.name : '—'],
        ['Seller’s note', d.note],
        ['Reviewed', d.reviewed_at ? dateTime(d.reviewed_at) : ''],
        ['Your note', d.review_note]
      ]) +
      '<label class="sr-only" for="review-note">Note</label><textarea id="review-note" placeholder="Note (optional)">' + esc(d.review_note || '') + '</textarea>' +
      '<p class="form-error" id="sheet-error" role="alert" hidden></p>' +
      '<div class="action-row">' +
        (d.status !== 'approved' ? '<button type="button" class="btn-desk" data-doc="approved" data-id="' + d.id + '">Approve</button>' : '') +
        (d.status !== 'rejected' ? '<button type="button" class="btn-line btn-danger" data-doc="rejected" data-id="' + d.id + '">Reject</button>' : '') +
        (d.lot ? '<button type="button" class="btn-line" data-open="lot" data-id="' + d.lot.id + '">Open The Lot</button>' : '') +
      '</div>');
  }

  const find = (list, id) => list.find(r => r.id === id);

  function openDetail(kind, id, intent) {
    if (kind === 'lot') { const l = find(db.lots, id); if (l) lotSheet(l, intent); }
    if (kind === 'user') { const p = find(db.profiles, id); if (p) userSheet(p, tab === 'sellers' ? 'seller' : tab === 'buyers' ? 'buyer' : null); }
    if (kind === 'enquiry') { const e = find(db.enquiries, id); if (e) enquirySheet(e); }
    if (kind === 'document') { const d = find(db.documents, id); if (d) documentSheet(d); }
  }

  /* ---------- Doing things ---------- */
  async function act(button, work, message) {
    button.disabled = true;
    try {
      await work();
      if (sheet.open) sheet.close();
      T7.toast(message);
      await load(true);
    } catch (err) {
      console.error(err);
      button.disabled = false;
      const box = document.getElementById('sheet-error');
      if (box && sheet.open) { box.textContent = err.message; box.hidden = false; }
      else T7.toast(err.message || 'That did not work.');
    }
  }

  function note() {
    const el = document.getElementById('review-note');
    return el && sheet.open ? el.value.trim() : '';
  }

  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-stop]')) return;

    if (t.closest('[data-close]') || t === sheet) { sheet.close(); return; }

    /* The only way an admin reaches the Trade board: these buttons set a
       pass for this tab, which trade.html and lot.html check. */
    const trade = t.closest('[data-admin-trade]');
    if (trade) {
      try { sessionStorage.setItem('t7.admin-trade', '1'); } catch (err) {}
      location.href = trade.dataset.adminTrade;
      return;
    }

    const tabBtn = t.closest('[data-tab]');
    if (tabBtn) { go(tabBtn.dataset.tab); return; }

    const review = t.closest('[data-review]');
    if (review) {
      const l = find(db.lots, review.dataset.id);
      const status = review.dataset.review;
      const n = note();
      if (status === 'rejected' && !n) {
        const box = document.getElementById('sheet-error');
        if (box) { box.textContent = 'Add a short note so the seller knows why.'; box.hidden = false; document.getElementById('review-note').focus(); }
        return;
      }
      act(review, () => T7.api.admin.reviewLot(l.id, status, status === 'live' ? '' : n),
        l.lot_id + (status === 'live' ? ' approved and live' : ' rejected'));
      return;
    }

    const doc = t.closest('[data-doc]');
    if (doc) {
      act(doc, () => T7.api.admin.reviewDocument(doc.dataset.id, doc.dataset.doc, note()), 'Document ' + doc.dataset.doc);
      return;
    }

    const user = t.closest('[data-user]');
    if (user) {
      act(user, () => T7.api.admin.setUserStatus(user.dataset.id, user.dataset.user), user.dataset.user === 'active' ? 'Account reactivated' : 'Account suspended');
      return;
    }

    const delUser = t.closest('[data-delete-user]');
    if (delUser) {
      /* Final, and it takes their lots and enquiries with it: ask once. */
      if (!delUser.dataset.sure) { delUser.dataset.sure = '1'; delUser.textContent = 'Yes, Delete Them And Their Data'; return; }
      act(delUser, () => T7.api.admin.deleteUser(delUser.dataset.deleteUser), 'Account deleted');
      return;
    }

    const enq = t.closest('[data-enq]');
    if (enq) {
      act(enq, () => T7.api.admin.setEnquiryStatus(enq.dataset.id, enq.dataset.enq), 'Enquiry updated');
      return;
    }

    const del = t.closest('[data-delete-lot]');
    if (del) {
      if (!del.dataset.sure) { del.dataset.sure = '1'; del.textContent = 'Yes, Delete For Good'; return; }
      act(del, () => T7.api.admin.deleteLot(del.dataset.deleteLot), 'Lot deleted');
      return;
    }

    const goBtn = t.closest('[data-go]');
    if (goBtn) {
      if (sheet.open) sheet.close();
      go(goBtn.dataset.go, JSON.parse(goBtn.dataset.filters || '{}'));
      return;
    }

    const sort = t.closest('[data-sort]');
    if (sort) {
      const v = view[tab];
      if (v.sort === sort.dataset.sort) v.dir = -v.dir;
      else { v.sort = sort.dataset.sort; v.dir = TABLES[tab].cols.find(c => c.key === v.sort).num || v.sort === 'created_at' ? -1 : 1; }
      document.getElementById('table-body').innerHTML = tableBody(tab);
      return;
    }

    const clear = t.closest('[data-clear]');
    if (clear) { view[tab].f = {}; render(); return; }

    const csv = t.closest('[data-csv]');
    if (csv) { downloadCsv(csv.dataset.csv); return; }

    const open = t.closest('[data-open]');
    if (open && !t.closest('a')) { openDetail(open.dataset.open, open.dataset.id, open.dataset.intent); return; }

    if (t.closest('#refresh')) load(true).then(() => T7.toast('Dashboard refreshed'));
  });

  /* Filters apply as you type or choose; only the table is redrawn, so
     the search box keeps its focus. */
  root.addEventListener('input', e => {
    const el = e.target.closest('[data-f]');
    if (!el || !view[tab]) return;
    const f = view[tab].f;
    if (el.value) f[el.dataset.f] = el.value; else delete f[el.dataset.f];
    document.getElementById('table-body').innerHTML = tableBody(tab);
    const clear = root.querySelector('[data-clear]');
    if (clear) clear.hidden = !Object.keys(f).length;
  });

  /* ---------- Load ---------- */
  async function load(keepTab) {
    db = await T7.api.admin.load();
    index();
    if (!keepTab) {
      const wanted = location.hash.slice(1);
      if (TABS.some(t => t[0] === wanted)) tab = wanted;
    }
    paintTabs();
    render();
  }

  T7.auth.require(['admin']).then(p => {
    if (!p) return;
    me = p;
    document.getElementById('desk-sub').textContent = 'Signed in as ' + T7.auth.displayName(p) + '. Everything on the Trade Desk: accounts, lots, enquiries and documents.';
    return load();
  }).catch(err => {
    console.error(err);
    root.innerHTML = '<div class="empty"><h3>The dashboard could not be loaded</h3><p>' + esc(err.message || 'Please try again in a moment.') +
      '</p><button type="button" class="btn-desk" onclick="location.reload()">Try Again</button></div>';
  });
})();
